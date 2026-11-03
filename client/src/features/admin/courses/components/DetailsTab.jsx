import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import { Button, Icon, IconButton, Panel, SelectField, Switch, TextareaField, TextField } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useUpdateCourseMutation } from '../api.js'
import FileUpload from './FileUpload.jsx'
import styles from './builder.module.css'

const toForm = (course) => ({
  title: course.title,
  category: course.category,
  level: course.level ?? '',
  language: course.language,
  summary: course.summary,
  about: course.about,
  lead: course.lead,
  tagline: course.tagline,
  designedFor: course.designedFor,
  outcomes: course.outcomes.length ? course.outcomes : [''],
  skillTags: course.skillTags.join(', '),
  pipelineCategory: course.pipelineCategory ?? '',
  isFree: course.isFree,
  // Prices are typed in major units; the API stores integer minor units (U24).
  prices: Object.fromEntries(course.currencies.map((currency) => [currency, String((course.prices.find((price) => price.currency === currency)?.amountMinor ?? '') / 100 || '')])),
})

/**
 * Details (M-107, U24): every learner-facing field, the cover, skill tags (M-114), the recruiter pipeline category
 * (OQ-3) and the price in all 8 currencies, or Free. Copy and prices stay editable after enrollment (M-108).
 */
export default function DetailsTab({ course }) {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const format = useFormat()
  const { data: config } = useGetConfigQuery()
  const [update, { isLoading, isSuccess, reset }] = useUpdateCourseMutation()
  const form = useFormState(() => toForm(course))
  const { values, set, errors } = form
  const recruiter = course.audience === 'recruiter'
  const options = (enumName) => (config?.enums[enumName] ?? []).map((value) => ({ value, label: t(`enums:${enumName}.${value}`) }))
  const field = (name) => ({
    value: values[name],
    onChange: (event) => {
      reset()
      set(name, event.target.value)
    },
    error: errorText.field(name, errors[name]),
  })

  async function handleSave(event) {
    event.preventDefault()
    const prices = Object.entries(values.prices).filter(([, value]) => value.trim())
    const badPrice = prices.find(([, value]) => !(Number(value) > 0))
    await form.run({ prices: badPrice && { key: 'invalid' } }, () =>
      update({
        id: course.id,
        title: values.title,
        category: values.category,
        level: values.level || null,
        language: values.language,
        summary: values.summary,
        ...(recruiter ? { lead: values.lead, tagline: values.tagline, designedFor: values.designedFor, pipelineCategory: values.pipelineCategory || null } : { about: values.about }),
        outcomes: values.outcomes.map((outcome) => outcome.trim()).filter(Boolean),
        skillTags: values.skillTags.split(',').map((tag) => tag.trim()).filter(Boolean),
        isFree: values.isFree,
        prices: prices.map(([currency, value]) => ({ currency, amountMinor: Math.round(Number(value) * 100) })),
      }).unwrap(),
    )
  }

  const setOutcome = (index, text) => set('outcomes', values.outcomes.map((outcome, at) => (at === index ? text : outcome)))
  const outcomeLimit = config?.limits.course.outcomes.max ?? 0

  return (
    <form onSubmit={handleSave} noValidate className={styles.stack} data-details-form>
      <Panel padding={24} className={styles.grid}>
        <TextField label={t('details.title')} {...field('title')} />
        <TextField label={t('details.category')} hint={t('details.categoryHint')} {...field('category')} />
        <SelectField label={t('details.level')} placeholder={t('details.choose')} options={options('courseLevel')} {...field('level')} />
        <SelectField label={t('details.language')} options={(config?.enums.language ?? []).map((value) => ({ value, label: format.languageName(value) }))} {...field('language')} />
        <TextareaField className={styles.wide} label={t('details.summary')} rows={2} {...field('summary')} />
        {recruiter ? (
          <>
            <TextareaField className={styles.wide} label={t('details.lead')} rows={3} {...field('lead')} />
            <TextField label={t('details.tagline')} {...field('tagline')} />
            <TextField label={t('details.designedFor')} {...field('designedFor')} />
            <SelectField label={t('details.pipelineCategory')} hint={t('details.pipelineHint')} placeholder={t('details.choose')} options={options('stageCategory')} {...field('pipelineCategory')} />
          </>
        ) : (
          <TextareaField className={styles.wide} label={t('details.about')} rows={3} {...field('about')} />
        )}
        <TextField className={styles.wide} label={t('details.skillTags')} hint={t('details.skillTagsHint')} {...field('skillTags')} />
      </Panel>

      <Panel padding={24} className={styles.stack}>
        <h2 className={styles.heading}>{t('details.outcomes')}</h2>
        {values.outcomes.map((outcome, index) => (
          <div key={index} className={styles.row}>
            <TextField
              className={styles.grow}
              aria-label={t('details.outcomeLabel', { number: index + 1 })}
              value={outcome}
              onChange={(event) => setOutcome(index, event.target.value)}
              error={errorText.field('outcomes', errors[`outcomes.${index}`])}
            />
            <IconButton label={t('details.removeOutcome')} onClick={() => set('outcomes', values.outcomes.filter((_, at) => at !== index))} disabled={values.outcomes.length === 1}>
              <Icon as={X} size={14} />
            </IconButton>
          </div>
        ))}
        {errors.outcomes && <p className={styles.error}>{errorText.field('outcomes', errors.outcomes)}</p>}
        <Button type="button" variant="outline" leftIcon={<Icon as={Plus} size={14} />} onClick={() => set('outcomes', [...values.outcomes, ''])} disabled={values.outcomes.length >= outcomeLimit}>
          {t('details.addOutcome')}
        </Button>
      </Panel>

      <Panel padding={24} className={styles.stack}>
        <FileUpload
          purpose="course_cover"
          label={t('details.cover')}
          current={course.cover}
          onUploaded={(file) => update({ id: course.id, coverFileId: file.id })}
        />
        {course.cover && <img src={course.cover.url} alt="" className={styles.cover} data-cover-preview />}
      </Panel>

      <Panel padding={24} className={styles.stack}>
        <div className={styles.row}>
          <h2 className={styles.heading}>{t('details.price')}</h2>
          <Switch label={t('details.free')} checked={values.isFree} onChange={(checked) => set('isFree', checked)} />
          <span className={styles.muted}>{t('details.free')}</span>
        </div>
        {!values.isFree && (
          <>
            <p className={styles.muted}>{t('details.priceHint')}</p>
            <div className={styles.prices}>
              {course.currencies.map((currency) => (
                <TextField
                  key={currency}
                  label={currency}
                  inputMode="decimal"
                  value={values.prices[currency]}
                  onChange={(event) => set('prices', { ...values.prices, [currency]: event.target.value })}
                  error={errorText.field('price', errors[`prices.${currency}`])}
                  data-price={currency}
                />
              ))}
            </div>
            {errors.prices && <p className={styles.error}>{errorText.field('price', errors.prices)}</p>}
          </>
        )}
      </Panel>

      {form.failure && <NoticeBanner>{errorText.code(form.failure)}</NoticeBanner>}
      <div className={styles.actions}>
        {isSuccess && (
          <span className={styles.saved} role="status">
            {t('builder.saved')}
          </span>
        )}
        <Button type="submit" loading={isLoading} data-save-details>
          {t('details.save')}
        </Button>
      </div>
    </form>
  )
}
