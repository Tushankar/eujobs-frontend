import { useAiFilled } from '../aiFilled.js'
import { useTranslation } from 'react-i18next'
import { currentRole } from '@/app/roles.js'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useGetConfigQuery, useGetCountriesQuery } from '@/app/api.js'
import { Checkbox, Icon, SelectField, Skeleton, SkeletonRegion, TextareaField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { useJobText } from '@/lib/jobText.js'
import { useSectors } from '@/lib/sectors.js'
import { useGetQualityChecksQuery } from '../api.js'
import { valuesToBody } from '../utils/jobForm.js'
import { useJobPreview } from '../utils/useJobPreview.js'
import { EligibleCountries, LanguageRequirements } from './ListFields.jsx'
import JobAiDraft from './JobAiDraft.jsx'
import AgencyTermsFields from '@/features/agency/components/AgencyTermsFields.jsx'
import JobPosting from './JobPosting.jsx'
import SkillPicker from './SkillPicker.jsx'
import styles from './JobStepFields.module.css'

const AGENCY_EMPLOYMENT = ['full_time', 'part_time']

/** M-060: the server's quality rules for the current values, with translated results. */
function QualityChecks({ values }) {
  const { t } = useTranslation()
  const { data: checks = [], isLoading } = useGetQualityChecksQuery(valuesToBody(values))
  return (
    <div>
      <p className={styles.note}>{t('jobs:quality.intro')}</p>
      {/* 2026-11-23: placeholders while the server checks (the step was blank). */}
      {isLoading && (
        <SkeletonRegion className={styles.checks}>
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} height={20} width={`${70 + (row % 3) * 8}%`} />
          ))}
        </SkeletonRegion>
      )}
      <ul className={styles.checks}>
        {checks.map((check) => (
          <li key={check.key} className={styles.check} data-check={check.key} data-ok={check.ok}>
            <Icon as={check.ok ? CircleCheck : CircleAlert} size={16} className={check.ok ? styles.ok : styles.warn} />
            <span>{t(`jobs:quality.${check.key}.${check.ok ? 'ok' : 'warn'}`, check.params)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Every currency an enabled country uses, as "EUR · Euro", for a remote job's salary (2026-11-16); EUR, GBP and USD first. */
function useCurrencyOptions() {
  const { i18n } = useTranslation()
  const { data: countries = [] } = useGetCountriesQuery()
  const names = new Intl.DisplayNames([i18n.language], { type: 'currency' })
  const first = ['EUR', 'GBP', 'USD']
  return [...new Set(countries.map((country) => country.currency))]
    .sort((a, b) => (first.includes(a) ? first.indexOf(a) : 9) - (first.includes(b) ? first.indexOf(b) : 9) || a.localeCompare(b))
    .map((code) => ({ value: code, label: `${code} · ${names.of(code)}` }))
}

/**
 * The fields (or read-only content) of one wizard step. `bind(name)` returns value/onChange/error props;
 * `errorOf(name)` the translated error of a field set with setValue.
 */
export default function JobStepFields({ step, values, bind, errorOf, setValue, onAiDrafted, companyName, choosesStatus, job }) {
  const { t } = useTranslation()
  const aiFilled = useAiFilled()
  const jobText = useJobText()
  const { data: config } = useGetConfigQuery()
  const { preview, currency, remote } = useJobPreview(values)
  // 2026-11-23: an agency job pays its rate (Agency terms) and has no salary: the rate shows where a salary would.
  const agency = currentRole() === 'agency'
  // 2026-11-24: a volunteer job is unpaid, so it has no salary.
  const volunteer = values.employmentType === 'volunteer'
  const sectors = useSectors()
  const rateAmount = Number(String(values.rateAmount ?? '').trim())
  const pay = agency
    ? currency && rateAmount > 0
      ? jobText.rate({ rate: { amountMinor: Math.round(rateAmount * 100), currency, period: values.ratePeriod } })
      : ''
    : volunteer
      ? t('jobs:fields.unpaid')
      : jobText.salary(preview)
  const enumOptions = (name) => (config?.enums[name] ?? []).map((key) => ({ value: key, label: t(`enums:${name}.${key}`) }))
  const currencies = useCurrencyOptions()
  const J = config?.limits.job

  switch (step) {
    case 'basics':
      return (
        <div className={styles.stack}>
          <TextField label={t('jobs:fields.title')} placeholder={t('jobs:fields.titlePlaceholder')} autoComplete="off" {...bind('title')} />
          <div className={styles.pair}>
            <TextField label={t('jobs:fields.company')} hint={t('jobs:fields.companyHint')} value={companyName} readOnly disabled />
            {/* 2026-11-20: an agency job is full or part time; its length is in its dates. */}
            <SelectField
              label={t('jobs:fields.employmentType')}
              options={enumOptions('employmentType').filter((option) => currentRole() !== 'agency' || AGENCY_EMPLOYMENT.includes(option.value))}
              {...bind('employmentType')}
            />
          </div>
          {/* 2026-11-24: the kind of work; candidates filter and browse jobs by it. */}
          <SelectField
            className={aiFilled('sector')}
            label={t('jobs:fields.sector')}
            hint={t('jobs:fields.sectorHint')}
            placeholder={t('jobs:fields.sectorPlaceholder')}
            options={sectors.options(values.sector)}
            {...bind('sector')}
          />
          {/* 2026-11-17: the job post writer fills the later steps' empty fields. */}
          <JobAiDraft values={values} setValue={setValue} onDrafted={onAiDrafted} />
        </div>
      )
    case 'responsibilities':
      return (
        <div className={styles.stack}>
          <TextareaField className={aiFilled('brief')} label={t('jobs:fields.brief')} hint={t('jobs:fields.briefHint')} rows={5} {...bind('brief')} />
          <TextareaField className={aiFilled('responsibilities')} label={t('jobs:fields.responsibilities')} hint={t('jobs:fields.responsibilitiesHint', { max: J?.responsibilities.max })} rows={5} {...bind('responsibilities')} />
        </div>
      )
    case 'required-skills':
      return (
        <SkillPicker
          className={aiFilled('requiredSkills')}
          label={t('jobs:fields.requiredSkills')}
          hint={t('jobs:fields.requiredSkillsHint')}
          error={errorOf('requiredSkills')}
          value={values.requiredSkills}
          excluded={values.preferredSkills}
          max={J?.requiredSkills.max}
          onChange={(skills) => setValue('requiredSkills', skills)}
        />
      )
    case 'preferred-skills':
      return (
        <SkillPicker
          className={aiFilled('preferredSkills')}
          label={t('jobs:fields.preferredSkills')}
          hint={t('jobs:fields.preferredSkillsHint')}
          error={errorOf('preferredSkills')}
          value={values.preferredSkills}
          excluded={values.requiredSkills}
          max={J?.preferredSkills.max}
          onChange={(skills) => setValue('preferredSkills', skills)}
        />
      )
    case 'experience':
      return (
        <div className={styles.stack}>
          <div className={styles.pair}>
            <SelectField className={aiFilled('level')} label={t('jobs:fields.level')} placeholder={t('jobs:fields.levelPlaceholder')} options={enumOptions('jobLevel')} {...bind('level')} />
            <TextField className={aiFilled('experienceYears')} label={t('jobs:fields.experienceYears')} inputMode="numeric" placeholder={t('jobs:fields.experiencePlaceholder')} {...bind('experienceYears')} />
          </div>
          <LanguageRequirements className={aiFilled('requiredLanguages')} value={values.requiredLanguages} max={J?.languages.max ?? 0} error={errorOf('requiredLanguages')} onChange={(rows) => setValue('requiredLanguages', rows)} />
        </div>
      )
    case 'location':
      return (
        <div className={styles.stack}>
          <div className={styles.pair}>
            <SelectField
              label={t('jobs:fields.workPreference')}
              placeholder={t('jobs:fields.workPreferencePlaceholder')}
              options={enumOptions('workPreference')}
              {...bind('workPreference')}
            />
            {values.workPreference && !remote && (
              <CityField label={t('jobs:fields.city')} hint={t('jobs:fields.cityHint')} name="jobCity" value={values.place} onChange={(place) => setValue('place', place, 'placeId')} error={errorOf('placeId')} />
            )}
          </div>
          {remote && <EligibleCountries value={values.remoteCountries} error={errorOf('remoteCountries')} onChange={(codes) => setValue('remoteCountries', codes)} />}
          {/* An agency sets its pay rate in Agency terms; a remote agency job still picks the currency it pays in. */}
          {agency && remote && <SelectField label={t('agency:terms.rateCurrency')} options={currencies} {...bind('salaryCurrency')} />}
          {volunteer && <p className={styles.note}>{t('jobs:fields.volunteerNoSalary')}</p>}
          {!agency && !volunteer && (
          <>
          <div className={styles.pair}>
            <TextField
              label={currency ? t('jobs:fields.salaryMin', { currency }) : t('jobs:fields.salaryNoCurrency')}
              inputMode="numeric"
              disabled={!currency}
              hint={currency ? undefined : t('jobs:fields.salaryNeedsPlace')}
              {...bind('salaryMin')}
            />
            <TextField label={currency ? t('jobs:fields.salaryMax', { currency }) : t('jobs:fields.salaryNoCurrency')} inputMode="numeric" disabled={!currency} {...bind('salaryMax')} />
          </div>
          <div className={styles.pair}>
            <SelectField label={t('jobs:fields.salaryPeriod')} options={enumOptions('salaryPeriod')} disabled={!currency} {...bind('salaryPeriod')} />
            {remote && <SelectField label={t('jobs:fields.salaryCurrency')} hint={t('jobs:fields.salaryCurrencyHint')} options={currencies} {...bind('salaryCurrency')} />}
          </div>
          <p className={styles.note}>{t('jobs:fields.salaryNote')}</p>
          </>
          )}
          <Checkbox name="visaSponsorship" checked={values.visaSponsorship} onChange={(event) => setValue('visaSponsorship', event.target.checked)}>
            {t('jobs:fields.visaSponsorship')}
          </Checkbox>
        </div>
      )
    case 'agency':
      return <AgencyTermsFields values={values} bind={bind} setValue={setValue} errorOf={errorOf} currency={currency} job={job} />
    case 'quality':
      return <QualityChecks values={values} />
    case 'review':
      return (
        <div className={styles.preview}>
          <h3 className={styles.previewTitle}>{preview.title || t('jobs:review.untitled')}</h3>
          <p className={styles.previewMeta}>
            {[companyName, jobText.place(preview), pay, preview.employmentType && t(`enums:employmentType.${preview.employmentType}`), sectors.name(values.sector), preview.level && t(`enums:jobLevel.${preview.level}`)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <JobPosting job={preview} />
        </div>
      )
    case 'publish':
      return (
        <div>
          <p className={styles.note}>{t(choosesStatus ? 'jobs:review.chooseStatus' : 'jobs:review.ready')}</p>
          <dl className={styles.summary}>
            <div>
              <dt>{t('jobs:review.role')}</dt>
              <dd>{preview.title}</dd>
            </div>
            <div>
              <dt>{t('jobs:review.where')}</dt>
              <dd>{[jobText.place(preview), preview.workPreference && t(`enums:workPreference.${preview.workPreference}`)].filter(Boolean).join(' · ') || t('jobs:review.notSet')}</dd>
            </div>
            <div>
              <dt>{t('jobs:review.requiredSkills')}</dt>
              <dd>{preview.requiredSkills.length || t('jobs:review.none')}</dd>
            </div>
            <div>
              <dt>{t(agency ? 'jobs:review.payRate' : 'jobs:review.salary')}</dt>
              <dd>{pay || t(agency ? 'jobs:review.notSet' : 'jobs:review.notShown')}</dd>
            </div>
          </dl>
        </div>
      )
    default:
      return null
  }
}
