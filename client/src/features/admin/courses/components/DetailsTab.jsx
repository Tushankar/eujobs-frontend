import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageIcon, Plus, X } from 'lucide-react'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import { Button, Icon, IconButton, Panel, SelectField, Switch, TextareaField, TextField } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useUpdateCourseMutation } from '../api.js'
import FileUpload from './FileUpload.jsx'
import styles from './builder.module.css'

/** The saved EUR price in major units, as typed text ('' when there is none). */
const savedEuro = (course) => {
  const eur = course.prices.find((price) => price.currency === 'EUR')
  return eur ? String(eur.amountMinor / 100) : ''
}

// Draft edits save on their own this long after the last keystroke.
const AUTOSAVE_MS = 1200

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
  // One price in euro, typed in major units; the server converts the other currencies at the ECB rate (U24).
  euroPrice: savedEuro(course),
})

/** The other currencies' prices as saved, with the ECB date they were converted at. */
function ConvertedPrices({ course }) {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const others = course.currencies
    .filter((currency) => currency !== 'EUR')
    .map((currency) => course.prices.find((price) => price.currency === currency))
    .filter(Boolean)
  if (!others.length) return null
  return (
    <div className={styles.converted} data-converted-prices>
      <p className={styles.convertedList}>{others.map((price) => format.money(price.amountMinor, price.currency)).join(' · ')}</p>
      <p className={styles.muted}>{course.priceRatesDate ? t('details.convertedAt', { date: format.date(course.priceRatesDate) }) : t('details.convertedManual')}</p>
    </div>
  )
}

/** How the course card reads to learners, live from the unsaved form. */
function LearnerPreview({ course, values }) {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const euro = Number(values.euroPrice)
  const price = values.isFree ? t('learnerPreview.free') : euro > 0 && format.money(Math.round(euro * 100), 'EUR')
  const meta = [
    values.level ? t(`enums:courseLevel.${values.level}`) : t('learnerPreview.noLevel'),
    format.languageName(values.language),
    t('table.lessons', { count: course.lessons.length }),
  ]

  return (
    <article className={styles.previewCard} data-learner-preview>
      <div className={styles.previewCover}>
        {course.cover ? (
          <img src={course.cover.url} alt="" />
        ) : (
          <>
            <Icon as={ImageIcon} size={28} />
            <span>{t('learnerPreview.cover')}</span>
          </>
        )}
      </div>
      <div className={styles.previewBody}>
        {values.category.trim() ? <span className={styles.previewCategory}>{values.category}</span> : <span className={styles.previewChip} aria-hidden="true" />}
        <h3 className={styles.previewName}>{values.title.trim() || t('learnerPreview.untitled')}</h3>
        <p className={styles.previewMeta}>{meta.join(' · ')}</p>
        {values.summary.trim() ? (
          <p className={styles.previewSummary}>{values.summary}</p>
        ) : (
          <div className={styles.previewLines} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        <div className={styles.previewFooter}>
          <span className={price ? styles.previewPrice : styles.previewNoPrice}>{price || t('learnerPreview.noPrice')}</span>
          <span className={styles.previewEnrol} aria-hidden="true">
            {t('learnerPreview.enrol')}
          </span>
        </div>
      </div>
    </article>
  )
}

/**
 * Details (M-107, U24): every learner-facing field, the cover, skill tags (M-114), the recruiter pipeline category
 * (OQ-3) and one EUR price (the server converts the other currencies), or Free. Copy and prices stay editable after
 * enrollment (M-108). Drafts autosave; a published course saves with the button.
 * Beside the form: the course card as learners will see it, and the publish `checklist` the builder passes in.
 */
export default function DetailsTab({ course, checklist }) {
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
    name,
    value: values[name],
    onChange: (event) => {
      reset()
      set(name, event.target.value)
    },
    error: errorText.field(name, errors[name]),
  })

  // Drafts save themselves; a published course keeps the Save button, so half-typed edits never go live.
  const autosave = course.status !== 'published'
  // `sent` = the values of the last save (or the opened course); anything newer is waiting to be saved.
  const [sent, setSent] = useState(values)
  const [lastSave, setLastSave] = useState('saved')
  const saveState = values !== sent ? 'pending' : lastSave
  const priceCheck = () => {
    const euro = values.euroPrice.trim()
    return euro && !(Number(euro) > 0) ? { key: 'invalid' } : undefined
  }

  function payload() {
    const euro = values.euroPrice.trim()
    return {
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
      // Only a changed EUR price is sent: it re-converts the other currencies at today's ECB rate.
      ...(euro !== savedEuro(course) && { euroPrice: euro ? Math.round(Number(euro) * 100) : null }),
    }
  }

  const save = () => form.run({ euroPrice: priceCheck() }, () => update(payload()).unwrap())

  async function handleSave(event) {
    event.preventDefault()
    await save()
  }

  async function autosaveNow() {
    setSent(values)
    setLastSave('saving')
    setLastSave((await save()) ? 'saved' : 'error')
  }

  // The latest render's save actions, for the timer and for leaving the tab.
  const latest = useRef({})
  useEffect(() => {
    latest.current = { autosaveNow, flush: autosave && saveState === 'pending' && !priceCheck() ? () => update(payload()) : null }
  })

  // Every edit restarts the timer.
  useEffect(() => {
    if (!autosave || values === sent) return undefined
    const timer = window.setTimeout(() => latest.current.autosaveNow(), AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [autosave, values, sent])

  // Leaving the tab or the page saves what is still waiting; closing the browser tab asks first.
  useEffect(() => () => latest.current.flush?.(), [])
  useEffect(() => {
    if (!autosave || saveState === 'saved') return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [autosave, saveState])

  const setOutcome = (index, text) => set('outcomes', values.outcomes.map((outcome, at) => (at === index ? text : outcome)))
  const outcomeLimit = config?.limits.course.outcomes.max ?? 0

  return (
    <form onSubmit={handleSave} noValidate className={styles.detailsLayout} data-details-form>
      <div className={styles.detailsMain}>
        <div className={styles.detailsIntro}>
          <h2 className={styles.detailsTitle}>{t('details.pageTitle')}</h2>
          <p className={styles.muted}>{t('details.pageText')}</p>
        </div>

        <Panel padding={24} className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('details.sectionCatalogue')}</h3>
          <div className={styles.grid}>
            <TextField className={styles.wide} label={t('details.title')} {...field('title')} />
            <TextField className={styles.wide} label={t('details.category')} hint={t('details.categoryHint')} {...field('category')} />
            <SelectField label={t('details.level')} placeholder={t('details.choose')} options={options('courseLevel')} {...field('level')} />
            <SelectField label={t('details.language')} options={(config?.enums.language ?? []).map((value) => ({ value, label: format.languageName(value) }))} {...field('language')} />
          </div>
        </Panel>

        <Panel padding={24} className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('details.sectionPitch')}</h3>
          <div className={styles.grid}>
            <TextareaField className={styles.wide} label={t('details.summary')} rows={2} {...field('summary')} />
            {recruiter ? (
              <>
                <TextareaField className={styles.wide} label={t('details.lead')} rows={3} {...field('lead')} />
                <TextField label={t('details.tagline')} {...field('tagline')} />
                <TextField label={t('details.designedFor')} {...field('designedFor')} />
                <SelectField className={styles.wide} label={t('details.pipelineCategory')} hint={t('details.pipelineHint')} placeholder={t('details.choose')} options={options('stageCategory')} {...field('pipelineCategory')} />
              </>
            ) : (
              <TextareaField className={styles.wide} label={t('details.about')} rows={4} {...field('about')} />
            )}
            <TextField className={styles.wide} label={t('details.skillTags')} hint={t('details.skillTagsHint')} {...field('skillTags')} />
          </div>
          <div className={styles.stack}>
            <h4 className={styles.label}>{t('details.outcomes')}</h4>
            {values.outcomes.map((outcome, index) => (
              <div key={index} className={styles.row}>
                <TextField
                  className={styles.grow}
                  aria-label={t('details.outcomeLabel', { number: index + 1 })}
                  value={outcome}
                  onChange={(event) => setOutcome(index, event.target.value)}
                  data-outcome={index}
                  error={errorText.field('outcomes', errors[`outcomes.${index}`])}
                />
                <IconButton label={t('details.removeOutcome')} onClick={() => set('outcomes', values.outcomes.filter((_, at) => at !== index))} disabled={values.outcomes.length === 1} icon={X} iconSize={14} />
              </div>
            ))}
            {errors.outcomes && <p className={styles.error}>{errorText.field('outcomes', errors.outcomes)}</p>}
            <Button type="button" variant="outline" leftIcon={<Icon as={Plus} size={14} />} onClick={() => set('outcomes', [...values.outcomes, ''])} disabled={values.outcomes.length >= outcomeLimit} className={styles.addOutcome}>
              {t('details.addOutcome')}
            </Button>
          </div>
        </Panel>

        <Panel padding={24} className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('details.sectionCoverPrice')}</h3>
          <FileUpload
            purpose="course_cover"
            label={t('details.cover')}
            current={course.cover}
            onUploaded={(file) => update({ id: course.id, coverFileId: file.id })}
          />
          {course.cover && <img src={course.cover.url} alt="" className={styles.cover} data-cover-preview />}
          <div className={styles.priceHead}>
            <div>
              <h4 className={styles.label}>{t('details.price')}</h4>
              {!values.isFree && <p className={styles.muted}>{t('details.euroHint')}</p>}
            </div>
            <div className={styles.row}>
              <Switch label={t('details.free')} checked={values.isFree} onChange={(checked) => set('isFree', checked)} />
              <span className={styles.freeLabel}>{t('details.free')}</span>
            </div>
          </div>
          {!values.isFree && (
            <div className={styles.euroRow}>
              <TextField
                className={styles.euroField}
                label={t('details.euroPrice')}
                inputMode="decimal"
                leftIcon={<span className={styles.euroSign}>€</span>}
                value={values.euroPrice}
                onChange={(event) => set('euroPrice', event.target.value)}
                error={errorText.field('price', errors.euroPrice)}
                data-price="EUR"
              />
              <ConvertedPrices course={course} />
            </div>
          )}
        </Panel>

        {form.failure && <NoticeBanner>{errorText.code(form.failure)}</NoticeBanner>}
        <div className={styles.actions}>
          {autosave ? (
            <span className={cx(styles.autosave, saveState === 'error' && styles.autosaveError)} role="status" data-autosave={saveState}>
              {t(`details.autosave.${saveState}`)}
            </span>
          ) : (
            <>
              {isSuccess && (
                <span className={styles.saved} role="status">
                  {t('builder.saved')}
                </span>
              )}
              <Button type="submit" loading={isLoading} data-save-details>
                {t('details.save')}
              </Button>
            </>
          )}
        </div>
      </div>

      <aside className={styles.detailsRail} aria-label={t('learnerPreview.label')}>
        <p className={styles.railLabel}>{t('learnerPreview.label')}</p>
        <LearnerPreview course={course} values={values} />
        {checklist}
      </aside>
    </form>
  )
}
