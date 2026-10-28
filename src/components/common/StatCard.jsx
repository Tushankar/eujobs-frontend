import { Icon } from '@/components/ui'
import styles from './StatCard.module.css'

/** KPI card: muted label with a corner glyph, large Manrope value, optional delta and caption. */
export default function StatCard({ label, value, delta, caption, icon, iconSrc }) {
  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <p className={styles.label}>{label}</p>
        {iconSrc ? (
          <img src={iconSrc} alt="" width={16} height={16} />
        ) : (
          <span className={styles.icon}>{icon && <Icon as={icon} size={16} />}</span>
        )}
      </div>
      <p className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {delta && <span className={styles.delta}>{delta}</span>}
      </p>
      <p className={styles.caption}>{caption}</p>
    </section>
  )
}
