import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorCode } from '@/app/api.js'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import { Button, Panel, TextField } from '@/components/ui'
import { useSaveAiUsageSettingsMutation } from '../api.js'
import styles from '../pages/UsagePage.module.css'

const PLANS = ['plus', 'recruiter_plus']
const INTERVALS = ['month', 'year']
// The expensive features with their own daily limit per user (2026-11-17).
const FEATURES = ['cv_draft', 'cv_snapshot']
// Which prices apply to a model, by its use: chat models bill input and output tokens, embeddings only input, the
// whisper-1 fallback per minute of audio.
const PRICE_FIELDS = { fast: ['input', 'output'], main: ['input', 'output'], other: ['input', 'output'], embedding: ['input'], transcribe: ['input', 'output'], transcribeFallback: ['minute'] }

const text = (value) => (value === null || value === undefined ? '' : String(value))
const numberOrNull = (value) => (value.trim() === '' ? null : Number(value))

function initialForm({ settings, models, placesSkus }) {
  const openaiPrice = (model) => settings.prices.openai.find((price) => price.model === model) ?? {}
  return {
    caps: Object.fromEntries(PLANS.map((plan) => [plan, Object.fromEntries(INTERVALS.map((interval) => [interval, text(settings.caps[plan]?.[interval])]))])),
    featureLimits: Object.fromEntries(FEATURES.map((kind) => [kind, text(settings.featureLimits?.[kind])])),
    burstPerMinute: text(settings.burstPerMinute),
    skillNamesPerDay: text(settings.skillNamesPerDay),
    budgets: { openai: text(settings.budgets.openai), places: text(settings.budgets.places) },
    openai: Object.fromEntries(models.map(({ model }) => [model, { input: text(openaiPrice(model).input), output: text(openaiPrice(model).output), minute: text(openaiPrice(model).minute) }])),
    places: Object.fromEntries(placesSkus.map((sku) => [sku, text(settings.prices.places.find((price) => price.sku === sku)?.perThousand)])),
  }
}

function toBody(form, { models, placesSkus }) {
  return {
    caps: Object.fromEntries(PLANS.map((plan) => [plan, Object.fromEntries(INTERVALS.map((interval) => [interval, Number(form.caps[plan][interval])]))])),
    featureLimits: Object.fromEntries(FEATURES.map((kind) => [kind, Number(form.featureLimits[kind])])),
    burstPerMinute: Number(form.burstPerMinute),
    skillNamesPerDay: Number(form.skillNamesPerDay),
    budgets: { openai: numberOrNull(form.budgets.openai), places: numberOrNull(form.budgets.places) },
    prices: {
      openai: models
        .map(({ model, use }) => {
          const fields = PRICE_FIELDS[use]
          const value = (field) => (fields.includes(field) ? numberOrNull(form.openai[model][field]) : null)
          return { model, input: value('input'), output: value('output'), minute: value('minute') }
        })
        .filter((price) => price.input !== null || price.output !== null || price.minute !== null),
      places: placesSkus.filter((sku) => form.places[sku].trim() !== '').map((sku) => ({ sku, perThousand: Number(form.places[sku]) })),
    },
  }
}

/**
 * The Usage tab's settings (owner 2026-11-17): daily AI uses per plan and billing interval (yearly gets more), the
 * per-minute burst, the daily skill-name lookups, monthly budgets in USD (empty: none; at 100 % the provider pauses)
 * and the prices the estimates use. `ai.view` sees them read-only.
 */
export default function UsageSettings({ data, readOnly }) {
  const { t } = useTranslation('aiMatching')
  const [form, setForm] = useState(() => initialForm(data))
  const [save, { isLoading, error, isSuccess, reset }] = useSaveAiUsageSettingsMutation()
  const fields = error?.data?.error?.fields ?? {}
  const invalid = (path) => (fields[path] ? t('usage.settings.invalid') : undefined)

  function set(path, value) {
    reset()
    setForm((current) => {
      const next = structuredClone(current)
      let target = next
      for (const key of path.slice(0, -1)) target = target[key]
      target[path.at(-1)] = value
      return next
    })
  }
  const input = (path, { key, ...props }) => (
    <TextField
      key={key}
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      value={path.reduce((value, key) => value[key], form)}
      onChange={(event) => set(path, event.target.value)}
      disabled={readOnly}
      error={invalid(path.join('.'))}
      {...props}
    />
  )

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await save(toBody(form, data)).unwrap()
    } catch {
      // The banner below names the problem.
    }
  }

  return (
    <Panel padding={24}>
      <form className={styles.settings} onSubmit={handleSubmit} data-usage-settings>
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('usage.settings.caps')}</legend>
          <p className={styles.groupHint}>{t('usage.settings.capsHint')}</p>
          <div className={styles.fields}>
            {PLANS.flatMap((plan) =>
              INTERVALS.map((interval) =>
                input(['caps', plan, interval], { key: `${plan}-${interval}`, label: t('usage.settings.capLabel', { plan: t(`enums:planKey.${plan}`), interval: t(`usage.interval.${interval}`) }), min: 1, step: 1, inputMode: 'numeric', 'data-cap': `${plan}.${interval}` }),
              ),
            )}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('usage.settings.limits')}</legend>
          <div className={styles.fields}>
            {FEATURES.map((kind) =>
              input(['featureLimits', kind], { key: kind, label: t(`usage.settings.featureLimit.${kind}`), hint: t('usage.settings.featureLimitHint'), min: 1, step: 1, inputMode: 'numeric', 'data-feature-limit': kind }),
            )}
            {input(['burstPerMinute'], { label: t('usage.settings.burst'), hint: t('usage.settings.burstHint'), min: 1, step: 1, inputMode: 'numeric' })}
            {input(['skillNamesPerDay'], { label: t('usage.settings.skillNames'), hint: t('usage.settings.skillNamesHint'), min: 1, step: 1, inputMode: 'numeric' })}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('usage.settings.budgets')}</legend>
          <p className={styles.groupHint}>{t('usage.settings.budgetsHint')}</p>
          <div className={styles.fields}>
            {['openai', 'places'].map((provider) =>
              input(['budgets', provider], { key: provider, label: t('usage.settings.budgetLabel', { provider: t(`usage.providers.${provider}`) }), placeholder: t('usage.settings.none'), 'data-budget': provider }),
            )}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('usage.settings.openaiPrices')}</legend>
          <p className={styles.groupHint}>{t('usage.settings.openaiPricesHint')}</p>
          <div className={styles.priceRows}>
            {data.models.map(({ model, use }) => (
              <div key={model} className={styles.priceRow} data-price-model={model}>
                <div className={styles.priceName}>
                  <span className={styles.strong}>{model}</span>
                  <span className={styles.muted}>{t(`usage.modelUse.${use}`)}</span>
                </div>
                <div className={styles.priceFields}>
                  {PRICE_FIELDS[use].map((field) => input(['openai', model, field], { key: field, label: t(`usage.settings.price.${field}`) }))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('usage.settings.placesPrices')}</legend>
          <p className={styles.groupHint}>{t('usage.settings.placesPricesHint')}</p>
          <div className={styles.fields}>
            {data.placesSkus.map((sku) => input(['places', sku], { key: sku, label: t(`usage.sku.${sku}`), 'data-price-sku': sku }))}
          </div>
        </fieldset>

        {error && <p className={styles.error} role="alert">{t(errorCode(error) === 'VALIDATION_FAILED' ? 'usage.settings.checkValues' : 'usage.settings.failed')}</p>}
        {isSuccess && <NoticeBanner>{t('usage.settings.saved')}</NoticeBanner>}
        {!readOnly && (
          <div className={styles.actions}>
            <Button type="submit" loading={isLoading}>
              {t('usage.settings.save')}
            </Button>
          </div>
        )}
      </form>
    </Panel>
  )
}
