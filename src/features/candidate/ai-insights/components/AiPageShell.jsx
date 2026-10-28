import { NavLink, useLocation } from 'react-router-dom'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import sparkle from '@/assets/icons/ai-sparkle-blue.svg'
import AiSafetyNotice from './AiSafetyNotice.jsx'
import styles from './AiPageShell.module.css'

const TABS = [
  { label: 'Profile insights', to: '/candidate/ai-insights', end: true },
  { label: 'Skill gap', to: '/candidate/ai-insights/skill-gap' },
  { label: 'Improve profile', to: '/candidate/ai-insights/improve-profile' },
  { label: 'Job match', to: '/candidate/ai-insights/job-match' },
  { label: 'Why recommended', to: '/candidate/ai-insights/why-recommended' },
]

/** Title block, section tabs, page content and the closing AI notice shared by the five AI insights pages. */
export default function AiPageShell({ eyebrow, title, description, children }) {
  // The chosen "Compare with a role" role travels with the tabs.
  const { search } = useLocation()
  return (
    <>
      <PageTitle
        eyebrow={`· ${eyebrow}`}
        title={title}
        description={description}
        actions={
          <span className={styles.badge}>
            <img src={sparkle} alt="" width={14} height={14} />
            AI-assisted · You’re in control
          </span>
        }
      />
      <nav className={styles.tabs} aria-label="AI insights sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={{ pathname: tab.to, search }}
            end={tab.end}
            className={({ isActive }) => cx(styles.tab, isActive && styles.active)}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.body}>{children}</div>
      <div className={styles.notice}>
        <AiSafetyNotice />
      </div>
    </>
  )
}
