import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './ViewToggle.module.css'

/**
 * Bordered toggle for switching a page between views (Roles / User access, Data / Funnel, Candidate / Recruiter courses).
 * 12px / 600 buttons, 40px tall. `items` = [{ id, label, icon }]; selection is controlled and the caller shows the view.
 * variant: "muted" (grey tray, white active), "primary" (white tray, blue active) or "wide" (grey tray, equal-width 48px tabs).
 */
export default function ViewToggle({ items, value, onChange, label, variant = 'muted', className }) {
  return (
    <div className={cx(styles.tray, styles[variant], className)} role="group" aria-label={label}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            className={cx(styles.item, active && styles.active)}
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
