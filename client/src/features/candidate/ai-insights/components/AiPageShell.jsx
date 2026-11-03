import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import sparkle from '@/assets/icons/ai-sparkle-blue.svg'
import AiSafetyNotice from './AiSafetyNotice.jsx'
import styles from './AiPageShell.module.css'

const TABS = [
  { key: 'overview', to: '/candidate/ai-insights', end: true },
  { key: 'skillGap', to: '/candidate/ai-insights/skill-gap' },
  { key: 'improve', to: '/candidate/ai-insights/improve-profile' },
  { key: 'jobMatch', to: '/candidate/ai-insights/job-match' },
  { key: 'why', to: '/candidate/ai-insights/why-recommended' },
]

/** Title block, section tabs, page content and the closing AI notice shared by the five AI insights pages. */
export default function AiPageShell({ eyebrow, title, description, children }) {
  const { t } = useTranslation('aiInsights')
  // The chosen role (?jobId=) travels with the tabs.
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
            {t('shell.badge')}
          </span>
        }
      />
      <nav className={styles.tabs} aria-label={t('shell.tabsLabel')}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={{ pathname: tab.to, search }} end={tab.end} className={({ isActive }) => cx(styles.tab, isActive && styles.active)}>
            {t(`shell.tabs.${tab.key}`)}
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
