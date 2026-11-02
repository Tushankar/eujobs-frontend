import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useGetCompanyApplicationsQuery } from '@/features/recruiter/applications/api.js'
import styles from './JobTalentList.module.css'

/** The job's active applications with their stage (Phase 6 task 3); the full list opens Applications filtered by the job. */
export default function JobApplicantsList({ jobId }) {
  const { t } = useTranslation()
  const { data } = useGetCompanyApplicationsQuery({ jobId })
  const applications = data?.items ?? []
  return (
    <section data-job-applicants>
      <h3 className={styles.heading}>{t('applications:jobApplicants.title')}</h3>
      {data && applications.length === 0 ? (
        <p className={styles.empty}>{t('applications:jobApplicants.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {applications.map(({ id, candidate, stage }) => (
            <li key={id}>
              <Link to={`/recruiter/find-candidates/${candidate.id}?jobId=${jobId}`} className={styles.row} aria-label={t('applications:recruiter.viewProfile', { name: candidate.fullName })}>
                <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={36} />
                <span className={styles.text}>
                  <span className={styles.name}>{candidate.fullName}</span>
                  <span className={styles.headline}>{candidate.headline}</span>
                </span>
                <PillBadge tone="accent">{stage.name}</PillBadge>
                <Icon as={ArrowUpRight} size={14} className={styles.arrow} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
