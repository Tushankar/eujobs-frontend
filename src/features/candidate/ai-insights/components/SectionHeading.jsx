import { cx } from '@/utils/cx.js'
import styles from './SectionHeading.module.css'

/** Manrope section title with a small muted description; `children` is an optional right-aligned action. */
export default function SectionHeading({ title, description, id, className, children }) {
  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.text}>
        <h2 className={styles.title} id={id}>
          {title}
        </h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {children}
    </div>
  )
}
