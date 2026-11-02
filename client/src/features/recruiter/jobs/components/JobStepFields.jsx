import { useTranslation } from 'react-i18next'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useGetConfigQuery, useGetCountriesQuery } from '@/app/api.js'
import { Checkbox, Icon, SelectField, TextareaField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { useJobText } from '@/lib/jobText.js'
import { useGetQualityChecksQuery } from '../api.js'
import { valuesToBody } from '../utils/jobForm.js'
import { EligibleCountries, LanguageRequirements } from './ListFields.jsx'
import JobPosting from './JobPosting.jsx'
import SkillPicker from './SkillPicker.jsx'
import styles from './JobStepFields.module.css'

/** M-060: the server's quality rules for the current values, with translated results. */
function QualityChecks({ values }) {
  const { t } = useTranslation()
  const { data: checks = [] } = useGetQualityChecksQuery(valuesToBody(values))
  return (
    <div>
      <p className={styles.note}>{t('jobs:quality.intro')}</p>
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

/**
 * The fields (or read-only content) of one wizard step. `bind(name)` returns value/onChange/error props;
 * `errorOf(name)` the translated error of a field set with setValue.
 */
export default function JobStepFields({ step, values, bind, errorOf, setValue, companyName, choosesStatus }) {
  const { t } = useTranslation()
  const jobText = useJobText()
  const { data: config } = useGetConfigQuery()
  const { data: countries = [] } = useGetCountriesQuery()
  const enumOptions = (name) => (config?.enums[name] ?? []).map((key) => ({ value: key, label: t(`enums:${name}.${key}`) }))
  const J = config?.limits.job
  const remote = values.workPreference === 'remote'
  // M-131: the salary currency follows the job country; remote jobs use the Remote row's currency (EUR).
  const countryCode = remote ? 'REMOTE' : values.place?.countryCode
  const currency = countries.find((country) => country.code === countryCode)?.currency
  const body = valuesToBody(values)
  // What candidates will see: the API shape of the job, with the city and the currency it will get.
  const preview = { ...body, location: remote ? null : values.place, country: countryCode, salary: currency && body.salary ? { ...body.salary, currency } : null }

  switch (step) {
    case 'basics':
      return (
        <div className={styles.stack}>
          <TextField label={t('jobs:fields.title')} placeholder={t('jobs:fields.titlePlaceholder')} autoComplete="off" {...bind('title')} />
          <div className={styles.pair}>
            <TextField label={t('jobs:fields.company')} hint={t('jobs:fields.companyHint')} value={companyName} readOnly disabled />
            <SelectField label={t('jobs:fields.employmentType')} options={enumOptions('employmentType')} {...bind('employmentType')} />
          </div>
        </div>
      )
    case 'responsibilities':
      return (
        <div className={styles.stack}>
          <TextareaField label={t('jobs:fields.brief')} hint={t('jobs:fields.briefHint')} rows={5} {...bind('brief')} />
          <TextareaField label={t('jobs:fields.responsibilities')} hint={t('jobs:fields.responsibilitiesHint', { max: J?.responsibilities.max })} rows={5} {...bind('responsibilities')} />
        </div>
      )
    case 'required-skills':
      return (
        <SkillPicker
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
            <SelectField label={t('jobs:fields.level')} placeholder={t('jobs:fields.levelPlaceholder')} options={enumOptions('jobLevel')} {...bind('level')} />
            <TextField label={t('jobs:fields.experienceYears')} inputMode="numeric" placeholder={t('jobs:fields.experiencePlaceholder')} {...bind('experienceYears')} />
          </div>
          <LanguageRequirements value={values.requiredLanguages} max={J?.languages.max ?? 0} error={errorOf('requiredLanguages')} onChange={(rows) => setValue('requiredLanguages', rows)} />
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
          </div>
          <p className={styles.note}>{t('jobs:fields.salaryNote')}</p>
          <Checkbox name="visaSponsorship" checked={values.visaSponsorship} onChange={(event) => setValue('visaSponsorship', event.target.checked)}>
            {t('jobs:fields.visaSponsorship')}
          </Checkbox>
        </div>
      )
    case 'quality':
      return <QualityChecks values={values} />
    case 'review':
      return (
        <div className={styles.preview}>
          <h3 className={styles.previewTitle}>{preview.title || t('jobs:review.untitled')}</h3>
          <p className={styles.previewMeta}>
            {[companyName, jobText.place(preview), jobText.salary(preview), preview.employmentType && t(`enums:employmentType.${preview.employmentType}`), preview.level && t(`enums:jobLevel.${preview.level}`)]
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
              <dt>{t('jobs:review.salary')}</dt>
              <dd>{jobText.salary(preview) || t('jobs:review.notShown')}</dd>
            </div>
          </dl>
        </div>
      )
    default:
      return null
  }
}
