import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import styles from './SettingsLayout.module.css'

const TABS = [
  { key: 'privacy', to: '/candidate/settings/privacy' },
  { key: 'notifications', to: '/candidate/settings/notifications' },
  { key: 'data', to: '/candidate/settings/data-account' },
  { key: 'billing', to: '/candidate/settings/billing' },
  { key: 'review', to: '/candidate/settings/review' },
]

/** Shared frame of the settings tabs: page title, tab navigation and the routed tab content. */
export default function SettingsLayout() {
  const { t } = useTranslation('account')
  return (
    <>
      <PageTitle title={t('layout.title')} description={t('layout.description')} />
      <nav className={styles.tabs} aria-label={t('layout.sections')}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}>
            {t(`layout.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <div className={styles.body}>
        <Outlet />
      </div>
    </>
  )
}
