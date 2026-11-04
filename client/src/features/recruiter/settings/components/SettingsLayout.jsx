import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { cx } from '@/utils/cx.js'
import styles from './SettingsLayout.module.css'

const TABS = [
  { key: 'notifications', to: '/recruiter/settings/notifications' },
  { key: 'data', to: '/recruiter/settings/data-account' },
  { key: 'billing', to: '/recruiter/settings/billing' },
]

/** Shared frame of the settings pages: page title, tab navigation, then the page's card(s). */
export default function SettingsLayout({ children }) {
  const { t } = useTranslation('account')
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('layout.title')}</h1>
        <p className={styles.lead}>{t('layout.description')}</p>
      </header>
      <nav className={styles.tabs} aria-label={t('layout.sections')}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}>
            {t(`layout.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <div className={styles.body}>{children}</div>
    </>
  )
}
