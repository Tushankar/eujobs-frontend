import { NavLink } from 'react-router-dom'
import { cx } from '@/utils/cx.js'
import styles from './SettingsLayout.module.css'

const TABS = [
  { label: 'Notifications', to: '/recruiter/settings/notifications' },
  { label: 'Data & account', to: '/recruiter/settings/data-account' },
  { label: 'Billing', to: '/recruiter/settings/billing' },
]

/** Shared frame of the settings pages: page title, tab navigation, then the page's card(s). */
export default function SettingsLayout({ children }) {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Your workspace. Your terms.</h1>
        <p className={styles.lead}>Simple controls for your privacy, notifications, and personal information.</p>
      </header>
      <nav className={styles.tabs} aria-label="Settings sections">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.body}>{children}</div>
    </>
  )
}
