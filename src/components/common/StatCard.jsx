import { Icon } from '@/components/ui'
import { useCountUp } from '@/hooks/useCountUp.js'
import styles from './StatCard.module.css'

/** KPI card: muted label with a corner glyph, large Manrope value (counts up), optional delta and caption. */
export default function StatCard({ label, value, delta, caption, icon, iconSrc }) {
  const shownValue = useCountUp(value)
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
        <span className={styles.value}>{shownValue}</span>
        {delta && <span className={styles.delta}>{delta}</span>}
      </p>
      <p className={styles.caption}>{caption}</p>
    </section>
  )
}
