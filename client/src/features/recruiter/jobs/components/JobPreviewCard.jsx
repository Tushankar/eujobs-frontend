import { useTranslation } from 'react-i18next'
import { useGetMeQuery } from '@/app/api.js'
import { CompanyLogo } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { useJobPreview } from '../utils/useJobPreview.js'
import styles from './JobPreviewCard.module.css'

const SHOWN_SKILLS = 6

/** The wizard's live side card: the job as candidates will see it in their list, built from the values being typed. */
export default function JobPreviewCard({ values, companyName, className }) {
  const { t } = useTranslation()
  const jobText = useJobText()
  const { data: me } = useGetMeQuery()
  const { preview } = useJobPreview(values)
  const where = [jobText.place(preview), preview.workPreference && t(`enums:workPreference.${preview.workPreference}`)].filter(Boolean).join(' · ')
  const salary = jobText.salary(preview)
  const tags = [
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
              {where && <p className={styles.meta}>{where}</p>}
            </div>
          </div>
          {salary && <p className={styles.salary}>{salary}</p>}
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
