import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon, Skeleton } from '@/components/ui'
import { useActiveIndicator } from '@/hooks/useActiveIndicator.js'
import { cx } from '@/utils/cx.js'
import styles from '@/components/common/TabBar.module.css'

/**
 * Moderation queue switcher: each tab is a route link (so a tab can be opened directly) with a count.
 * `tabs` = [{ id, label, icon, count, loading, to }]; a loading tab shows a placeholder for its count.
 */
export default function QueueTabs({ tabs, value }) {
  const { t } = useTranslation('moderation')
  const barRef = useRef(null)
  useActiveIndicator(barRef, value)

  return (
    <div className={styles.bar} role="tablist" aria-label={t('queues')} ref={barRef}>
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
            {tab.loading ? <Skeleton shape="pill" width={22} height={20} /> : <span className={styles.count}>{tab.count}</span>}
          </Link>
        )
      })}
    </div>
  )
}
