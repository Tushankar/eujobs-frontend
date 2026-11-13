import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button, Icon, IconButton, Modal, Switch, TextField } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useUpdatePlanMutation } from '../api.js'
import styles from './PlanEditor.module.css'

const LANGUAGES = ['en', 'es', 'fr']
const MAX_FEATURES = 12

/** The server's rule for an automatic yearly price: 12 months less the discount, whole units (tens from 1,000 up). */
function yearlyAmount(monthlyMinor, percent) {
  const major = (monthlyMinor * 12 * (100 - percent)) / 100 / 100
  return (major >= 1000 ? Math.round(major / 10) * 10 : Math.round(major)) * 100
}

const toMajor = (minor) => String(minor / 100)
/** "12", "12.5" or "12,50" → 1250; null when it is not an amount. */
function toMinor(text) {
  const value = Number(String(text).trim().replace(',', '.'))
  return text.trim() && Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null
}

/** The draft of `plan` (amounts as typed text; an empty yearly amount = automatic). */
const draftOf = (plan) => ({
  name: { ...plan.name },
  features: plan.features.map((feature) => ({ en: feature.en, es: feature.es, fr: feature.fr })),
  yearlyEnabled: plan.yearlyEnabled,
  discount: String(plan.yearlyDiscountPercent),
  prices: plan.prices.map((row) => ({ currency: row.currency, monthly: toMajor(row.monthlyMinor), yearly: row.yearlyOverride ? toMajor(row.yearlyMinor) : '' })),
})

/**
 * Admin › Payments › Plans › Edit (2026-11-13): the name and features in each language and, for a paid plan, the
 * monthly price per currency, the yearly discount and any currency's own yearly price. Read only without
 * `finance.manage`.
 */
export default function PlanEditor({ plan, manage, onClose, onSaved }) {
  const { t } = useTranslation('adminPayments')
  const format = useFormat()
  const errorText = useErrorText()
  const [draft, setDraft] = useState(() => draftOf(plan))
  const [language, setLanguage] = useState('en')
  const [checked, setChecked] = useState(false)
  const [updatePlan, { isLoading: saving, error: saveError }] = useUpdatePlanMutation()
  const readOnly = !manage

  const change = (fields) => setDraft((current) => ({ ...current, ...fields }))
  const setFeature = (index, value) => change({ features: draft.features.map((feature, at) => (at === index ? { ...feature, [language]: value } : feature)) })
  const moveFeature = (index, by) => {
    const features = [...draft.features]
    ;[features[index], features[index + by]] = [features[index + by], features[index]]
    change({ features })
  }
  const setPrice = (index, field, value) => change({ prices: draft.prices.map((row, at) => (at === index ? { ...row, [field]: value } : row)) })

  // Checks shown once Save was pressed.
  const percent = Number(draft.discount)
  const discountValid = Number.isInteger(percent) && percent >= 0 && percent <= 50
  const rows = draft.prices.map((row) => {
    const monthlyMinor = toMinor(row.monthly)
    const customMinor = row.yearly.trim() ? toMinor(row.yearly) : null
    const autoMinor = monthlyMinor && discountValid ? yearlyAmount(monthlyMinor, percent) : null
    const yearlyMinor = customMinor ?? autoMinor
    let yearlyError = row.yearly.trim() && !customMinor ? 'amount' : null
    if (!yearlyError && customMinor && monthlyMinor && customMinor > monthlyMinor * 12) yearlyError = 'tooHigh'
    return { ...row, monthlyMinor, customMinor, autoMinor, yearlyMinor, monthlyError: monthlyMinor ? null : 'amount', yearlyError }
  })
  const missingText = (language) => !draft.name[language].trim() || draft.features.some((feature) => !feature[language].trim())
  const invalid = LANGUAGES.some(missingText) || (plan.paid && (!discountValid || rows.some((row) => row.monthlyError || row.yearlyError)))
  const pricesChanged =
    plan.paid &&
    rows.some((row, index) => row.monthlyMinor !== plan.prices[index].monthlyMinor || row.yearlyMinor !== plan.prices[index].yearlyMinor)
  const keeping = plan.subscribers.month + plan.subscribers.year

  async function save() {
    setChecked(true)
    if (invalid) return
    const body = {
      key: plan.key,
      name: Object.fromEntries(LANGUAGES.map((code) => [code, draft.name[code].trim()])),
      features: draft.features.map((feature) => Object.fromEntries(LANGUAGES.map((code) => [code, feature[code].trim()]))),
      ...(plan.paid && {
        yearlyEnabled: draft.yearlyEnabled,
        yearlyDiscountPercent: percent,
        prices: rows.map((row) => ({ currency: row.currency, monthlyMinor: row.monthlyMinor, yearlyMinor: row.customMinor })),
      }),
    }
    try {
      onSaved(await updatePlan(body).unwrap())
    } catch {
      // Shown under the form.
    }
  }

  const amountError = (code) => code && t(`plans.errors.${code}`)
  return (
    <Modal
      open
      onClose={onClose}
      title={t(readOnly ? 'plans.editor.viewTitle' : 'plans.editor.title', { plan: plan.name.en })}
      description={t(plan.paid ? 'plans.editor.descriptionPaid' : 'plans.editor.description')}
      width={760}
      divided
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            {t('plans.editor.close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('plans.editor.cancel')}
            </Button>
            <Button onClick={save} loading={saving}>
              {t('plans.editor.save')}
            </Button>
          </>
        )
      }
    >
      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="plan-texts">
          <div className={styles.sectionHead}>
            <h3 id="plan-texts" className={styles.sectionTitle}>
              {t('plans.editor.texts')}
            </h3>
            <div className={styles.languages} role="tablist" aria-label={t('plans.editor.language')}>
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="tab"
                  aria-selected={language === code}
                  className={cx(styles.language, language === code && styles.languageActive)}
                  onClick={() => setLanguage(code)}
                >
                  {t(`plans.editor.languages.${code}`)}
                  {checked && missingText(code) && <span className={styles.missingDot} aria-label={t('plans.errors.languageMissing')} />}
                </button>
              ))}
            </div>
          </div>
          <TextField
            label={t('plans.editor.name')}
            value={draft.name[language]}
            maxLength={40}
            disabled={readOnly}
            error={checked && !draft.name[language].trim() ? t('plans.errors.required') : undefined}
            onChange={(event) => change({ name: { ...draft.name, [language]: event.target.value } })}
          />
          <div className={styles.features}>
            <p className={styles.label}>{t('plans.editor.features')}</p>
            <ol className={styles.featureList}>
              {draft.features.map((feature, index) => (
                <li key={index} className={styles.feature}>
                  <TextField
                    className={styles.featureField}
                    aria-label={t('plans.editor.feature', { number: index + 1 })}
                    value={feature[language]}
                    maxLength={160}
                    disabled={readOnly}
                    error={checked && !feature[language].trim() ? t('plans.errors.required') : undefined}
                    onChange={(event) => setFeature(index, event.target.value)}
                  />
                  {!readOnly && (
                    <span className={styles.featureActions}>
                      <IconButton icon={ArrowUp} iconSize={14} className={styles.iconButton} label={t('plans.editor.moveUp', { number: index + 1 })} disabled={index === 0} onClick={() => moveFeature(index, -1)} />
                      <IconButton
                        icon={ArrowDown}
                        iconSize={14}
                        className={styles.iconButton}
                        label={t('plans.editor.moveDown', { number: index + 1 })}
                        disabled={index === draft.features.length - 1}
                        onClick={() => moveFeature(index, 1)}
                      />
                      <IconButton
                        icon={Trash2}
                        iconSize={14}
                        className={styles.iconButton}
                        label={t('plans.editor.removeFeature', { number: index + 1 })}
                        disabled={draft.features.length === 1}
                        onClick={() => change({ features: draft.features.filter((_, at) => at !== index) })}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {!readOnly && draft.features.length < MAX_FEATURES && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Icon as={Plus} size={13} />}
                onClick={() => change({ features: [...draft.features, { en: '', es: '', fr: '' }] })}
                className={styles.addFeature}
              >
                {t('plans.editor.addFeature')}
              </Button>
            )}
          </div>
        </section>

        {plan.paid && (
          <section className={styles.section} aria-labelledby="plan-prices">
            <div className={styles.sectionHead}>
              <h3 id="plan-prices" className={styles.sectionTitle}>
                {t('plans.editor.prices')}
              </h3>
            </div>
            <div className={styles.yearly}>
              <div className={styles.yearlyToggle}>
                <Switch checked={draft.yearlyEnabled} onChange={(value) => change({ yearlyEnabled: value })} label={t('plans.editor.yearlyEnabled')} disabled={readOnly} />
                <span>{t('plans.editor.yearlyEnabled')}</span>
              </div>
              <TextField
                className={styles.discount}
                label={t('plans.editor.discount')}
                hint={t('plans.editor.discountHint')}
                inputMode="numeric"
                value={draft.discount}
                disabled={readOnly}
                error={checked && !discountValid ? t('plans.errors.discount') : undefined}
                onChange={(event) => change({ discount: event.target.value })}
                rightSlot="%"
              />
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('plans.editor.currency')}</th>
                    <th scope="col">{t('plans.editor.monthly')}</th>
                    <th scope="col">{t('plans.editor.yearly')}</th>
                    <th scope="col">{t('plans.editor.saving')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const saving = row.monthlyMinor && row.yearlyMinor ? Math.round((1 - row.yearlyMinor / (row.monthlyMinor * 12)) * 100) : null
                    return (
                      <tr key={row.currency} data-price-row={row.currency}>
                        <th scope="row">
                          {row.currency} <span className={styles.symbol}>{format.currencySymbol(row.currency)}</span>
                        </th>
                        <td>
                          <TextField
                            aria-label={t('plans.editor.monthlyFor', { currency: row.currency })}
                            inputMode="decimal"
                            value={row.monthly}
                            disabled={readOnly}
                            error={checked ? amountError(row.monthlyError) : undefined}
                            onChange={(event) => setPrice(index, 'monthly', event.target.value)}
                          />
                        </td>
                        <td>
                          <TextField
                            aria-label={t('plans.editor.yearlyFor', { currency: row.currency })}
                            inputMode="decimal"
                            value={row.yearly}
                            placeholder={row.autoMinor ? toMajor(row.autoMinor) : ''}
                            disabled={readOnly || !draft.yearlyEnabled}
                            error={checked ? amountError(row.yearlyError) : undefined}
                            onChange={(event) => setPrice(index, 'yearly', event.target.value)}
                            rightSlot={
                              row.yearly.trim() ? (
                                !readOnly && (
                                  <IconButton icon={RotateCcw} iconSize={14} className={styles.iconButton} label={t('plans.editor.useAuto', { currency: row.currency })} onClick={() => setPrice(index, 'yearly', '')} />
                                )
                              ) : (
                                <span className={styles.auto}>{t('plans.editor.auto')}</span>
                              )
                            }
                          />
                        </td>
                        <td className={styles.saving}>{draft.yearlyEnabled && saving !== null ? `${format.number(saving)}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>{t('plans.editor.pricesNote')}</p>
          </section>
        )}

        {pricesChanged && keeping > 0 && (
          <p className={styles.impact} role="status">
            {t('plans.editor.impact', { count: keeping })}
          </p>
        )}
        <div role="alert">
          {checked && invalid && <p className={styles.failure}>{t('plans.errors.form')}</p>}
          {saveError && <p className={styles.failure}>{errorText.code(saveError)}</p>}
        </div>
      </div>
    </Modal>
  )
}
