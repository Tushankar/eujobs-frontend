import { Check, CirclePlay, LockKeyhole } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import styles from './LessonRow.module.css'

/**
 * A row of the curriculum. kind = "intro" (free preview, always open) or "lesson" (locked until the course is
 * purchased; once open it toggles between "Mark complete" and "Completed").
 */
export default function LessonRow({ kind, title, subtitle, unlocked = false, done = false, onClick }) {
  if (kind === 'intro') {
    return (
      <button type="button" className={styles.row} onClick={onClick}>
        <span className={cx(styles.circle, styles.open)}>
          <Icon as={CirclePlay} size={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </span>
        <PillBadge tone="info">Free</PillBadge>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={cx(styles.row, !unlocked && styles.locked)}
      disabled={!unlocked}
      aria-pressed={unlocked ? done : undefined}
      onClick={onClick}
    >
      <span className={cx(styles.circle, unlocked && styles.open, done && styles.done)}>
        <Icon as={!unlocked ? LockKeyhole : done ? Check : CirclePlay} size={15} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      <span className={cx(styles.state, done && styles.stateDone)}>
        {!unlocked ? 'Locked' : done ? 'Completed' : 'Mark complete'}
      </span>
    </button>
  )
}
