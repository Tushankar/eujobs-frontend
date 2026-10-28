import { cx } from '@/utils/cx.js'
import styles from './Badge.module.css'

/** DS Badge: word label with an optional status dot. tone = gray | green | violet | amber | blue | red. */
export default function Badge({ tone = 'gray', dot = false, className, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}
