import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './SettingRow.module.css'

/** A settings card (LinkedIn style): title, optional lead line, then hairline-separated `SettingRow`s. */
export function SettingsSection({ title, description, footer, children, ...rest }) {
  return (
    <Panel padding={0} className={styles.card} {...rest}>
      <h2 className={styles.heading}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      <ul className={styles.rows}>{children}</ul>
      {footer}
    </Panel>
  )
}

/**
 * One settings row: grey icon, label, current value and an Edit pill. The whole head toggles the row's form open below
 * it; a row with an `action` (a button) shows it instead; rows with neither (the email) are read-only.
 */
export default function SettingRow({ id, icon, label, value, note, open, onToggle, action, children }) {
  const { t } = useTranslation()
  const text = (
    <>
      <Icon as={icon} size={20} className={styles.rowIcon} />
      <span className={styles.rowText}>
        <span className={styles.label}>{label}</span>
        {!open && <span className={styles.value}>{value}</span>}
      </span>
    </>
  )
  return (
    <li className={cx(styles.row, open && styles.rowOpen)} data-setting={id}>
      {children ? (
        <button type="button" className={styles.rowHead} aria-expanded={open} aria-controls={`setting-${id}`} onClick={onToggle}>
          {text}
          <span className={styles.pill}>{open ? t('common:cancel') : t('account:admin.edit')}</span>
        </button>
      ) : (
        <div className={styles.rowHead}>
          {text}
          {action ?? <Icon as={Lock} size={16} className={styles.rowIcon} />}
        </div>
      )}
      {note && !open && <div className={styles.note}>{note}</div>}
      {open && (
        <div id={`setting-${id}`} className={styles.rowBody}>
          {children}
        </div>
      )}
    </li>
  )
}
