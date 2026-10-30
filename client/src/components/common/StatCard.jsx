import { Icon } from '@/components/ui'
import { useCountUp } from '@/hooks/useCountUp.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './StatCard.module.css'

/**
 * KPI card: muted label with a corner glyph, large Manrope value, optional delta and caption.
 * `value` is a number, counted up and shown through `format` (default: a locale number, §2.15).
 * Screens not yet on the API may still pass a ready string, which is shown as is.
 */
export default function StatCard({ label, value, format, delta, caption, icon, iconSrc }) {
  const formatter = useFormat()
  const shown = useCountUp(value)
  const text = typeof shown === 'number' ? (format ?? ((number) => formatter.number(Math.round(number))))(shown) : shown
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
        <span className={styles.value}>{text}</span>
        {delta && <span className={styles.delta}>{delta}</span>}
      </p>
      <p className={styles.caption}>{caption}</p>
    </section>
  )
}
