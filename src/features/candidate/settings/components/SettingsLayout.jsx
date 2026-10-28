import { NavLink, Outlet } from 'react-router-dom'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import styles from './SettingsLayout.module.css'

const TABS = [
  { label: 'Privacy & visibility', to: '/candidate/settings/privacy' },
  { label: 'Notifications', to: '/candidate/settings/notifications' },
  { label: 'Data & account', to: '/candidate/settings/data-account' },
]

/** Shared frame of the three settings tabs: page title, tab navigation and the routed tab content. */
export default function SettingsLayout() {
  return (
    <>
      <PageTitle
        title="Your workspace. Your terms."
        description="Simple controls for your privacy, notifications, and personal information."
      />
      <nav className={styles.tabs} aria-label="Settings sections">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.body}>
        <Outlet />
      </div>
    </>
  )
}
