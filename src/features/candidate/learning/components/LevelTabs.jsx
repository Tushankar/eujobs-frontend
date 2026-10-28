import { cx } from '@/utils/cx.js'
import styles from './LevelTabs.module.css'

/** Course level filter ("All levels" + one button per level). Controlled; the parent filters the grid. */
export default function LevelTabs({ levels, value, onChange }) {
  const options = ['All levels', ...levels]
  return (
    <div className={styles.tray} role="group" aria-label="Course level">
      {options.map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
