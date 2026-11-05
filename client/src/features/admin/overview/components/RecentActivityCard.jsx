import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CircleCheck, ShieldCheck } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { useAuditText } from '@/features/admin/audit-logs/useAuditText.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './RecentActivityCard.module.css'

/* Line widths (%) of the placeholder events. */
const SKELETON_LINES = [88, 72, 94, 66, 80]

/** "Recent platform activity" (M-174): the latest 5 audit events with a link to the audit log, plus the oversight note. */
export default function RecentActivityCard({ events, showLink, loading }) {
  const { t } = useTranslation('adminOverview')
  const format = useFormat()
  const describe = useAuditText()
  return (
    <Panel padding={24} aria-labelledby="recent-activity-title">
      <SectionTitle id="recent-activity-title" title={t('recent.title')}>
        {showLink && (
          <Link to="/admin/audit-logs" className={styles.link}>
            {t('recent.auditLog')}
          </Link>
        )}
      </SectionTitle>
      {loading ? (
        <SkeletonRegion className={styles.list}>
          {SKELETON_LINES.map((width, index) => (
            <div key={index} className={styles.item}>
              <Skeleton shape="circle" width={15} height={15} className={styles.itemIcon} />
              <span className={styles.skeletonText}>
                <Skeleton width={`${width}%`} />
              </span>
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={styles.item} data-recent-event={event.type}>
              <Icon as={CircleCheck} size={15} className={styles.itemIcon} />
              {t('recent.item', { text: describe(event), date: format.dateTime(event.at) })}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        <Icon as={ShieldCheck} size={15} className={styles.noteIcon} />
        {t('recent.note')}
      </p>
    </Panel>
  )
}
