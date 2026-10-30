import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import { formatSalary, profileMatch } from '../data/jobUtils.js'
import styles from './AiJobSummaryModal.module.css'

/** "AI-assisted job summary" dialog (Job Details Page_6): an evidence-based read of one job against the profile. */
export default function AiJobSummaryModal({ job, open, onClose, applied, onApply }) {
  if (!job) return null
  const aligned = job.skills.slice(0, job.matchingSkills)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI-assisted job summary"
      width={512}
      className={styles.dialog}
      footer={
        <>
          <Button variant="secondary" className={styles.closeButton} onClick={onClose}>
            Close summary
          </Button>
          <Button
            disabled={applied}
            rightIcon={applied ? undefined : <Icon as={ArrowRight} size={13} />}
            leftIcon={applied ? <Icon as={Check} size={13} /> : undefined}
            onClick={() => {
              onApply(job.id)
              onClose()
            }}
          >
            {applied ? 'Applied' : 'Apply Now'}
          </Button>
        </>
      }
    >
      <div className={styles.preview}>
        <span className={styles.previewBadge}>
          <Icon as={Sparkles} size={11} />
          Local evidence-based preview
        </span>
        <h3 className={styles.previewTitle}>
          {job.title} at {job.company}
        </h3>
        <p className={styles.previewText}>
          This {job.level.toLowerCase()} {job.type.toLowerCase()} role focuses on {job.skills.join(', ')}. It is based in{' '}
          {job.location} with a {job.workMode.toLowerCase()} working model
          {job.salaryMin == null ? '.' : ` and lists compensation of ${formatSalary(job)} per year.`}
        </p>
      </div>

      <h3 className={styles.heading}>How it compares with your profile</h3>
      <p className={styles.sub}>{profileMatch(job)}% profile match · Evidence, not a hiring decision</p>
      {aligned.length > 0 && (
        <ul className={styles.aligned} aria-label="Skills aligned with your profile">
          {aligned.map((skill) => (
            <li key={skill} className={styles.alignedChip}>
              <Icon as={Check} size={10} strokeWidth={2.2} />
              {skill} aligned
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        Your profile reports 5 years of experience and a remote work preference. Missing profile evidence does not mean you
        lack a skill.
      </p>
    </Modal>
  )
}
