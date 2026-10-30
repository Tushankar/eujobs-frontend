import { cx } from '@/utils/cx.js'
import styles from './Switch.module.css'

/**
 * Toggle switch (role="switch"). `label` is the accessible name; pass visible text via children if needed.
 * `size="lg"` is the 40x24 variant used by the settings rows.
 */
export default function Switch({ checked, onChange, label, disabled = false, size = 'md', className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx(styles.switch, size === 'lg' && styles.lg, checked && styles.on, className)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  )
}
