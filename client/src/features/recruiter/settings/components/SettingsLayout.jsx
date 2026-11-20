import { hiringPath } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { tabRowRef } from '@/hooks/scrollActiveIntoView.js'
import { cx } from '@/utils/cx.js'
import styles from './SettingsLayout.module.css'

// Paths inside settings of the recruiter or agency workspace.
const TABS = [
  { key: 'notifications', to: 'notifications' },
  { key: 'data', to: 'data-account' },
  { key: 'billing', to: 'billing' },
  { key: 'courses', to: 'courses' },
  { key: 'review', to: 'review' },
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
      <nav ref={tabRowRef} className={styles.tabs} aria-label={t('layout.sections')}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={hiringPath(`settings/${tab.to}`)} className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}>
            {t(`layout.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <div className={styles.body}>{children}</div>
    </>
  )
}
