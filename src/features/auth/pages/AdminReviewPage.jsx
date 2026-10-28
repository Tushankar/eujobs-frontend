import { Link } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import StepHeading from '../components/StepHeading.jsx'
import { useOnboarding } from '../utils/useOnboarding.js'
import styles from './AdminReviewPage.module.css'

/**
 * Onboarding step 5 of 5: the application is waiting for human admin review. Recruiter access
 * stays locked (as the frame says), so the real next action is returning to sign in.
 */
export default function AdminReviewPage() {
  const { data } = useOnboarding()
  const documentCount = Object.values(data.documents).filter(Boolean).length

  const summary = [
    { label: 'Applicant', value: data.fullName },
    { label: 'Company', value: data.companyName },
    { label: 'Email', value: 'Verified' },
    { label: 'Phone', value: 'Verified' },
    { label: 'Documents', value: `${documentCount} submitted` },
    { label: 'Recruiter access', value: 'Locked pending approval' },
  ]

  return (
    <>
      <StepHeading
        title="Admin review & approval"
        description="Your information has been securely prepared for human review."
      />

      <div className={styles.result}>
        <div className={styles.status}>
          <span className={styles.statusIcon}>
            <Icon as={ShieldCheck} size={29} />
          </span>
          <span className={styles.statusBadge}>Under Review</span>
        </div>
        <div>
          <h3 className={styles.resultTitle}>Application submitted successfully</h3>
          <p className={styles.resultText}>
            Your recruiter profile is now in the verification queue. We will keep access locked until an administrator
            completes the review.
          </p>
        </div>
      </div>

      <dl className={styles.summary}>
        {summary.map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>{item.label}</dt>
            <dd className={styles.summaryValue}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.actions}>
        <Button as={Link} to="/recruiter/sign-in" variant="outline">
          Return to sign in
        </Button>
        <Button disabled rightIcon={<Icon as={Lock} size={14} />} className={styles.locked}>
          Recruiter tools locked
        </Button>
      </div>
    </>
  )
}
