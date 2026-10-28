import { cx } from '@/utils/cx.js'
import styles from './SectionTitle.module.css'

/** Card / section heading: Manrope 18 title, small muted description, optional right-aligned `children` (actions, badge). */
export default function SectionTitle({ title, description, id, className, children }) {
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
