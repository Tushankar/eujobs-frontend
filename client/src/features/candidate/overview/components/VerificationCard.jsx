import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './RailCards.module.css'

const CHECKS = ['Identity', 'Academic qualifications', 'Employment documents']

/** "Profile Verification": the three checks (all not started in the demo) and a link to the Verification page. */
export default function VerificationCard() {
  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.cardTitle}>Profile Verification</h2>
          <p className={styles.verifyText}>Complete all three checks for premium job eligibility.</p>
        </div>
        <span className={styles.roundTile}>
          <Icon as={CircleCheck} size={18} strokeWidth={1.5} />
        </span>
      </div>
      <ul className={styles.checks}>
        {CHECKS.map((label) => (
          <li key={label} className={styles.checkRow}>
            <span className={styles.checkLabel}>
              <Icon as={CircleCheck} size={14} className={styles.checkIdle} />
              {label}
            </span>
            <span className={styles.muted}>Not started</span>
          </li>
        ))}
      </ul>
      <div className={styles.progressRow}>
        <span className={styles.muted}>Verification progress</span>
        <span className={styles.strong}>0 of 3</span>
      </div>
      <PillBadge tone="neutral" className={styles.locked}>
        Premium jobs locked
      </PillBadge>
      <Button as={Link} to="/candidate/verification" variant="secondary" fullWidth className={styles.verifyButton} rightIcon={<Icon as={ArrowRight} size={12} />}>
        Verify profile
      </Button>
    </section>
  )
}
