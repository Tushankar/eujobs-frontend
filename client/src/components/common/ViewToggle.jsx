import { useRef } from 'react'
import { Icon } from '@/components/ui'
import { useActiveIndicator } from '@/hooks/useActiveIndicator.js'
import { cx } from '@/utils/cx.js'
import styles from './TabBar.module.css'

/**
 * Underline tabs for switching a page between views (Roles / User access, Board / Funnel, Candidate / Recruiter courses).
 * `items` = [{ id, label, icon, iconSize? }]; selection is controlled and the caller shows the view. The underline slides between items.
 */
export default function ViewToggle({ items, value, onChange, label, className }) {
  const trayRef = useRef(null)
  useActiveIndicator(trayRef, value)

  return (
    <div className={cx(styles.bar, className)} role="group" aria-label={label} ref={trayRef}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(item.id)}
          >
            {item.icon && <Icon as={item.icon} size={item.iconSize ?? 14} />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
