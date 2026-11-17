import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useGetCompanyApplicationsQuery } from '@/features/recruiter/applications/api.js'
import { useShortlist } from '../utils/useShortlist.js'
import JobAiShortlist, { ShortlistButton } from './JobAiShortlist.jsx'
import { PeopleRowsSkeleton } from './JobTalentList.jsx'
import styles from './JobTalentList.module.css'

/** The job's active applications with their stage (Phase 6 task 3); the full list opens Applications filtered by the job. */
export default function JobApplicantsList({ jobId }) {
  const { t } = useTranslation()
  const { data, isLoading } = useGetCompanyApplicationsQuery({ jobId })
  const applications = data?.items ?? []
  // 2026-11-17: the AI shortlist of the newest unreviewed applicants (Recruiter Plus).
  const shortlist = useShortlist(jobId)
  return (
    <section data-job-applicants>
      <div className={styles.headRow}>
        <h3 className={styles.heading}>{t('applications:jobApplicants.title')}</h3>
        {applications.length > 0 && <ShortlistButton onClick={shortlist.run} loading={shortlist.isLoading} />}
      </div>
      <JobAiShortlist jobId={jobId} state={shortlist} onClose={shortlist.reset} />
      {isLoading ? (
        <PeopleRowsSkeleton pill />
      ) : data && applications.length === 0 ? (
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
