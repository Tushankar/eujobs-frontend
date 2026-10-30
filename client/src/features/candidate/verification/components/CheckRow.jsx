import { ArrowRight, BadgeCheck } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './CheckRow.module.css'

/** One credential check: copy, accepted evidence, and the action that fits its current status. */
export default function CheckRow({ check, icon, entry, onSubmit, onMarkReviewed }) {
  const status = entry?.status ?? 'not-started'
  return (
    <li className={styles.row}>
      <span className={styles.tile}>
        <Icon as={icon} size={18} />
      </span>
      <div className={styles.body}>
        <h3 className={styles.title}>
          {check.label}
          {status === 'verified' && (
            <span className={styles.tick} role="img" aria-label="Reviewed">
              <Icon as={BadgeCheck} size={16} />
            </span>
          )}
        </h3>
        <p className={styles.description}>{check.description}</p>
        <p className={styles.accepted}>{check.accepted}</p>
        {entry && (
          <p className={styles.submitted}>
            Submitted: {entry.evidenceType} · {entry.fileName}
          </p>
        )}
      </div>
      <div className={styles.action}>
        {status === 'not-started' && (
          <Button
            variant="outline"
            rightIcon={<Icon as={ArrowRight} size={13} />}
            aria-label={`Submit ${check.label.toLowerCase()} for review`}
            onClick={onSubmit}
          >
            Submit for review
          </Button>
        )}
        {status === 'in-review' && (
          <>
            <PillBadge tone="warning">In review</PillBadge>
            <Button variant="ghost" size="sm" onClick={onMarkReviewed}>
              Mark as reviewed (demo)
            </Button>
          </>
        )}
        {status === 'verified' && (
          <PillBadge tone="success" dot>
            Verified
          </PillBadge>
        )}
      </div>
    </li>
  )
}
