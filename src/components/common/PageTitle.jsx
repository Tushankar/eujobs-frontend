import { cx } from '@/utils/cx.js'
import styles from './PageTitle.module.css'

/** Page heading block: optional eyebrow, Manrope title, description and a right-aligned action slot. */
export default function PageTitle({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
