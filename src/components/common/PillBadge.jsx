import { cx } from '@/utils/cx.js'
import styles from './PillBadge.module.css'

/**
 * Small rounded-rect label used for statuses, tags and skills (10px / 500). `dot` prepends a status dot.
 * tone = success | warning | neutral | accent | primary | info.
 */
export default function PillBadge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}
