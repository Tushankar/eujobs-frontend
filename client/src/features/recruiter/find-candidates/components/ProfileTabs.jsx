import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { cx } from '@/utils/cx.js'
import styles from './ProfileTabs.module.css'

const TABS = [
  { key: 'overview', to: '' },
  { key: 'experience', to: 'experience' },
  { key: 'skills', to: 'skills' },
  { key: 'education', to: 'education' },
  { key: 'resume', to: 'resume' },
  { key: 'activity', to: 'activity' },
  { key: 'notes', to: 'notes' },
]

/** Underlined route tabs of the candidate profile. `basePath` is the profile's own path; the match job (`?jobId`) is kept. */
export default function ProfileTabs({ basePath }) {
  const { t } = useTranslation()
  const { search } = useLocation()
  return (
    <nav className={styles.tabs} aria-label={t('discovery:profile.tabsLabel')}>
      {TABS.map((tab) => (
        <NavLink key={tab.key} to={`${tab.to ? `${basePath}/${tab.to}` : basePath}${search}`} end className={({ isActive }) => cx(styles.tab, isActive && styles.active)}>
          {t(`discovery:profile.tabs.${tab.key}`)}
        </NavLink>
      ))}
    </nav>
  )
}
