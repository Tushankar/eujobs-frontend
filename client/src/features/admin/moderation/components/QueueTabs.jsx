import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './QueueTabs.module.css'

/**
 * Moderation queue switcher: each tab is a route link (so a tab can be opened directly) with a count badge.
 * `tabs` = [{ id, label, icon, count, to }].
 */
export default function QueueTabs({ tabs, value }) {
  return (
    <div className={styles.tray} role="tablist" aria-label="Moderation queues">
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <Link
            key={tab.id}
            to={tab.to}
            role="tab"
            aria-selected={active}
            className={cx(styles.tab, active && styles.active)}
          >
            <Icon as={tab.icon} size={14} />
            {tab.label}
            <PillBadge tone="warning">{tab.count}</PillBadge>
          </Link>
        )
      })}
    </div>
  )
}
