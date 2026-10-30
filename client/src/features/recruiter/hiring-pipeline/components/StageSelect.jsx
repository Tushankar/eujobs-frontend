import { ChevronDown } from 'lucide-react'
import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './StageSelect.module.css'

/**
 * Compact native select for an applicant's stage (the keyboard-friendly alternative to dragging).
 * `options` = [{ id, name }]; variant = "table" (Applications row) | "card" (board card, full width).
 */
export default function StageSelect({ options, value, onChange, label, variant = 'table', className }) {
  return (
    <span className={cx(styles.root, styles[variant], className)}>
      <select className={styles.select} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <Icon as={ChevronDown} size={16} strokeWidth={2.2} className={styles.chevron} />
    </span>
  )
}
