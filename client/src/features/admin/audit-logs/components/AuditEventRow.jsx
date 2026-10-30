import { useId } from 'react'
import { ChevronDown, Clock } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import { formatDate, formatDateTime } from '../utils/formatDate.js'
import styles from './AuditEventRow.module.css'

/** One audit event: a disclosure button ("Title · date" + Local event badge) that expands to the event details. */
export default function AuditEventRow({ event, open, onToggle }) {
  const detailId = useId()
  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className={styles.clock}>
          <Icon as={Clock} size={16} />
        </span>
        <span className={styles.summary}>
          {event.title} · {formatDate(event.at)}
        </span>
        <PillBadge tone="neutral">Local event</PillBadge>
        <Icon as={ChevronDown} size={14} className={cx(styles.chevron, open && styles.open)} />
      </button>
      {open && (
        <dl className={styles.detail} id={detailId}>
          <div>
            <dt>Category</dt>
            <dd>{event.category}</dd>
          </div>
          <div>
            <dt>Recorded by</dt>
            <dd>{event.actor}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatDateTime(event.at)}</dd>
          </div>
          <div className={styles.wide}>
            <dt>Details</dt>
            <dd>{event.detail}</dd>
          </div>
        </dl>
      )}
    </li>
  )
}
