import { cx } from '@/utils/cx.js'
import styles from './StatusBadge.module.css'

/** Dot + label status pill used for match strength and application status. tone = success | info | violet | neutral. */
export default function StatusBadge({ tone = 'neutral', children, className }) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  )
}
