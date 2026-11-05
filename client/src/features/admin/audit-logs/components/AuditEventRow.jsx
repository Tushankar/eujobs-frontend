import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Clock } from 'lucide-react'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useAuditText } from '../useAuditText.js'
import styles from './AuditEventRow.module.css'

const ACTOR_TONES = { admin: 'info', user: 'neutral', system: 'accent' }

/* Sentence widths (px) of the placeholder events; the actor badge follows the sentence, as in a loaded row. */
const SKELETON_LINES = [380, 300, 420, 340, 400, 280, 360, 440, 320, 390]

/** The event list's shape while the first page loads: the clock, the sentence and the actor badge per row. */
export function AuditEventsSkeleton() {
  return (
    <SkeletonRegion>
      <ul>
        {SKELETON_LINES.map((width, index) => (
          <li key={index} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.clock}>
                <Skeleton shape="circle" width={16} height={16} />
              </span>
              <span className={styles.skeletonSummary}>
                <Skeleton width={width} height={12} />
              </span>
              <Skeleton shape="pill" width={56} />
            </div>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

/** One audit event: a disclosure button (sentence · date, actor type) that expands to its category, actor, time and subject. */
export default function AuditEventRow({ event, open, onToggle }) {
  const { t } = useTranslation(['audit', 'enums'])
  const format = useFormat()
  const auditText = useAuditText()
  const detailId = useId()
  const actorType = t(`enums:actorType.${event.actor.type}`)
  return (
    <li className={styles.item} data-audit-type={event.type} data-actor-type={event.actor.type}>
      <button type="button" className={styles.row} aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className={styles.clock}>
          <Icon as={Clock} size={16} />
        </span>
        <span className={styles.summary}>
          {auditText(event)} · {format.date(event.at)}
        </span>
        <PillBadge tone={ACTOR_TONES[event.actor.type]}>{actorType}</PillBadge>
        <Icon as={ChevronDown} size={14} className={cx(styles.chevron, open && styles.open)} />
      </button>
      {open && (
        <dl className={styles.detail} id={detailId}>
          <div>
            <dt>{t('detail.category')}</dt>
            <dd>{t(`enums:auditCategory.${event.category}`)}</dd>
          </div>
          <div>
            <dt>{t('detail.actor')}</dt>
            <dd>{event.actor.name ? t('actor', { name: event.actor.name, type: actorType }) : actorType}</dd>
          </div>
          <div>
            <dt>{t('detail.time')}</dt>
            <dd>{format.dateTime(event.at)}</dd>
          </div>
          {event.target && (
            <div>
              <dt>{t('detail.target')}</dt>
              <dd>{t(`target.${event.target.type}`)}</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  )
}
