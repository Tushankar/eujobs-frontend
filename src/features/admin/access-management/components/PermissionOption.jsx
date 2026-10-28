import { cx } from '@/utils/cx.js'
import styles from './PermissionOption.module.css'

/**
 * One permission checkbox. variant "row" is the plain list row of the Create custom role matrix;
 * "tile" is the bordered card of Manage access, tinted blue while checked.
 */
export default function PermissionOption({ variant = 'row', checked, onChange, label, description }) {
  return (
    <label className={cx(styles.option, styles[variant], checked && styles.checked)}>
      <input type="checkbox" className={styles.input} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{description}</span>
      </span>
    </label>
  )
}
