import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import JobLogo from '@/features/candidate/jobs/components/JobLogo.jsx'
import { APPLICATION_STATUS } from '@/features/candidate/jobs/data/applications.js'
import { getJob } from '@/features/candidate/jobs/data/jobs.js'
import { jobPath } from '@/features/candidate/jobs/data/jobUtils.js'
import { useApplications } from '@/features/candidate/jobs/hooks/useApplications.js'
import styles from './RailCards.module.css'

/** Latest three live applications, each linking to its job; footer links to the full Applications page. */
export default function ApplicationActivityCard() {
  const { applications } = useApplications()
  const recent = applications.filter((item) => item.status !== 'withdrawn').slice(0, 3)

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.activityTitle}>Application activity</h2>
        <Link to="/candidate/applications" className={styles.openLink} aria-label="Open applications">
          <Icon as={ArrowUpRight} size={15} />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className={styles.lead}>No applications yet. Apply to a role and its progress will show here.</p>
      ) : (
        <ul className={styles.activityList}>
          {recent.map((application) => {
            const job = getJob(application.jobId)
            const status = APPLICATION_STATUS[application.status]
            return (
              <li key={application.id}>
                <Link to={jobPath(job.id)} className={styles.activityRow}>
                  <JobLogo company={job.company} logo={job.logo} size={36} />
                  <span className={styles.activityText}>
                    <span className={styles.activityRole}>{job.title}</span>
                    <span className={styles.activityCompany}>{job.company}</span>
                    <StatusBadge tone={status.tone} className={styles.activityBadge}>
                      {status.label}
                    </StatusBadge>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Link to="/candidate/applications" className={styles.trackLink}>
        Track your applications
        <Icon as={ArrowRight} size={11} />
      </Link>
    </section>
  )
}
