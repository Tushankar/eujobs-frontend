import { useRef } from 'react'
import { useActiveIndicator } from '@/hooks/useActiveIndicator.js'
import { cx } from '@/utils/cx.js'
import styles from './TabBar.module.css'

/** Single-choice filter row drawn as underline tabs. `options` = [{ id, label, count? }]; a count shows as a pill beside the label. */
export default function FilterChips({ options, value, onChange, label, className }) {
  const barRef = useRef(null)
  useActiveIndicator(barRef, value)

  return (
    <div className={cx(styles.bar, className)} role="group" aria-label={label} ref={barRef}>
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
