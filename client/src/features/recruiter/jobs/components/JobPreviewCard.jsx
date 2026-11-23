import { useTranslation } from 'react-i18next'
import { useGetConfigQuery, useGetMeQuery } from '@/app/api.js'
import { currentRole } from '@/app/roles.js'
import { CompanyLogo } from '@/components/ui'
import { useGetClientsQuery } from '@/features/agency/api.js'
import { useDuration } from '@/features/agency/useDuration.js'
import { useJobText } from '@/lib/jobText.js'
import { useJobPreview } from '../utils/useJobPreview.js'
import styles from './JobPreviewCard.module.css'

const SHOWN_SKILLS = 6

/** The wizard's live side card: the job as candidates will see it in their list, built from the values being typed. */
export default function JobPreviewCard({ values, companyName, className }) {
  const { t } = useTranslation()
  const jobText = useJobText()
  const { data: me } = useGetMeQuery()
  const { preview, currency } = useJobPreview(values)
  // 2026-11-23: an agency job shows what its candidates see: the client (or "confidential"), dates and length, rate, hours.
  const agency = currentRole() === 'agency'
  const duration = useDuration()
  const { data: config } = useGetConfigQuery()
  const { data: clients } = useGetClientsQuery(undefined, { skip: !agency })
  const client = agency && clients?.items.find((entry) => entry.id === values.clientId)
  const rateAmount = Number(String(values.rateAmount ?? '').trim())
  const rate = agency && currency && rateAmount > 0 ? jobText.rate({ rate: { amountMinor: Math.round(rateAmount * 100), currency, period: values.ratePeriod } }) : ''
  const hours = agency ? (String(values.hoursPerWeek ?? '').trim() === '' ? config?.limits.job.agency.defaultHours[values.employmentType] : Number(values.hoursPerWeek)) : null
  const agencyFacts = agency
    ? [
        values.startDate && values.endDate && `${jobText.dates({ startDate: values.startDate, endDate: values.endDate })} · ${duration(values.startDate, values.endDate)}`,
        hours > 0 && t('jobs:preview.agencyHours', { count: hours }),
      ].filter(Boolean)
    : []
  const where = [jobText.place(preview), preview.workPreference && t(`enums:workPreference.${preview.workPreference}`)].filter(Boolean).join(' · ')
  const salary = agency ? rate : jobText.salary(preview)
  const tags = [
    agency && t('agency:candidate.agencyTag'),
    preview.employmentType && t(`enums:employmentType.${preview.employmentType}`),
    preview.level && t(`enums:jobLevel.${preview.level}`),
    preview.visaSponsorship && t('jobs:posting.visa'),
  ].filter(Boolean)
  const skills = preview.requiredSkills
  const company = me?.company

  return (
    <aside className={className} aria-label={t('jobs:preview.title')}>
      <div className={styles.card}>
        <div className={styles.head}>
          <p className={styles.label}>{t('jobs:preview.title')}</p>
          <p className={styles.hint}>{t('jobs:preview.hint')}</p>
        </div>
        <div className={styles.job}>
          <div className={styles.top}>
            {companyName && <CompanyLogo name={companyName} id={company?.id} src={company?.logoUrl ?? undefined} size={48} />}
            <div className={styles.titles}>
              <p className={preview.title ? styles.jobTitle : styles.placeholder}>{preview.title || t('jobs:review.untitled')}</p>
              <p className={styles.company}>{companyName}</p>
              {agency && (
                <p className={styles.meta} data-preview-client>
                  {values.showClient && client ? t('agency:candidate.forClient', { client: client.name }) : t('agency:candidate.confidentialClient')}
                </p>
              )}
              {where && <p className={styles.meta}>{where}</p>}
            </div>
          </div>
          {salary && <p className={styles.salary}>{salary}</p>}
          {agencyFacts.length > 0 && (
            <ul className={styles.facts} data-preview-agency>
              {agencyFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          )}
          {tags.length > 0 && (
            <ul className={styles.tags}>
              {tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
          {skills.length > 0 && (
            <div className={styles.skills}>
              <p className={styles.skillsLabel}>{t('jobs:posting.requiredSkills')}</p>
              <ul className={styles.chips}>
                {skills.slice(0, SHOWN_SKILLS).map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
                {skills.length > SHOWN_SKILLS && <li className={styles.more}>+{skills.length - SHOWN_SKILLS}</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
