import { Icon } from '@/components/ui'
import styles from './StepGroup.module.css'

/** Grey group card of an onboarding step: icon tile, title, subtitle, then the fields. */
export default function StepGroup({ icon, title, description, children }) {
  return (
    <section className={styles.group}>
      <div className={styles.head}>
        <span className={styles.iconTile}>
          <Icon as={icon} size={17} />
        </span>
        <div>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
