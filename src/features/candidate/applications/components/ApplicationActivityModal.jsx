import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon, Modal } from '@/components/ui'
import JobLogo from '@/features/candidate/jobs/components/JobLogo.jsx'
import { APPLICATION_STATUS, APPLICATION_STEPS, formatApplied } from '@/features/candidate/jobs/data/applications.js'
import { jobPath } from '@/features/candidate/jobs/data/jobUtils.js'
import styles from './ApplicationActivityModal.module.css'

/** "View activity": where an application stands in the Applied → Under review → Interview steps. */
export default function ApplicationActivityModal({ application, job, onClose, onWithdraw }) {
  if (!application || !job) return null
  const withdrawn = application.status === 'withdrawn'
  const reached = APPLICATION_STEPS.indexOf(application.status)

  return (
    <Modal
      open
      onClose={onClose}
      title="Application activity"
      description={`${job.title} · ${job.company}`}
      width={440}
      footer={
        <>
          <Button as={Link} to={jobPath(job.id)} variant="secondary" onClick={onClose}>
            View job
          </Button>
          {!withdrawn && (
            <Button variant="danger" onClick={() => onWithdraw(application)}>
              Withdraw application
            </Button>
          )}
        </>
      }
    >
      <div className={styles.job}>
        <JobLogo company={job.company} logo={job.logo} size={36} />
        <div>
          <p className={styles.jobTitle}>{job.title}</p>
          <p className={styles.jobMeta}>
            {job.company} · {job.workMode} · Applied {formatApplied(application.appliedAt)}
          </p>
        </div>
      </div>

      {withdrawn ? (
        <p className={styles.withdrawn}>You withdrew this application. You can apply again from the job page.</p>
      ) : (
        <ol className={styles.steps} aria-label="Application progress">
          {APPLICATION_STEPS.map((step, index) => {
            const done = index <= reached
            return (
              <li key={step} className={cx(styles.step, done && styles.done)} aria-current={index === reached ? 'step' : undefined}>
                <span className={styles.marker}>{done && <Icon as={Check} size={11} strokeWidth={2.4} />}</span>
                <span className={styles.stepLabel}>{APPLICATION_STATUS[step].label}</span>
                {index === reached && <span className={styles.current}>Current status</span>}
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
