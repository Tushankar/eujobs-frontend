import { ChevronDown } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './SortSelect.module.css'

/** Compact native select (DS 11px dropdown) for sort order. `options` = [{ value, label }]. */
export default function SortSelect({ options, value, onChange, label }) {
  return (
    <div className={styles.root}>
      <select className={styles.select} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon as={ChevronDown} size={12} className={styles.chevron} />
    </div>
  )
}
