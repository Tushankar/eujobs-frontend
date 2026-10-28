import { NavLink } from 'react-router-dom'
import { cx } from '@/utils/cx.js'
import styles from './ProfileTabs.module.css'

const TABS = [
  { label: 'Overview', to: '' },
  { label: 'Experience', to: 'experience' },
  { label: 'Skills', to: 'skills' },
  { label: 'Education', to: 'education' },
  { label: 'Resume', to: 'resume' },
  { label: 'Activity', to: 'activity' },
  { label: 'Notes', to: 'notes' },
]

/** Underlined route tabs of the candidate profile. `basePath` is the profile's own path. */
export default function ProfileTabs({ basePath }) {
  return (
    <nav className={styles.tabs} aria-label="Candidate profile sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.to ? `${basePath}/${tab.to}` : basePath}
          end
          className={({ isActive }) => cx(styles.tab, isActive && styles.active)}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
