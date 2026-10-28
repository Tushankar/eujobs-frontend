import { cx } from '@/utils/cx.js'
import styles from './FilterChips.module.css'

/** Row of pill filter buttons (single choice). `options` = [{ id, label }]. */
export default function FilterChips({ options, value, onChange, label, className }) {
  return (
    <div className={cx(styles.row, className)} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={cx(styles.chip, active && styles.active)}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
