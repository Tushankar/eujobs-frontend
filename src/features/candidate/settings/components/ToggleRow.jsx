import { Switch } from '@/components/ui'
import styles from './ToggleRow.module.css'

/** A settings row: label + explanation on the left, an immediately-applied switch on the right. */
export default function ToggleRow({ label, description, checked, onChange }) {
  return (
    <li className={styles.row}>
      <div className={styles.text}>
        <p className={styles.label}>{label}</p>
        <p className={styles.description}>{description}</p>
      </div>
      <Switch size="lg" label={label} checked={checked} onChange={onChange} />
    </li>
  )
}
