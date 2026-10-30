import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import styles from './QueueRow.module.css'

/**
 * One moderation queue item: icon tile, headline with optional badge, supporting lines, status badge and
 * a link into the review dialog. `lines` = [{ text, tone: 'sub' | 'summary' | 'meta' }].
 */
export default function QueueRow({ icon, alert = false, title, badge, lines, status, note, actionLabel, to }) {
  return (
    <li className={styles.row}>
      <span className={cx(styles.tile, alert && styles.alert)}>
        <Icon as={icon} size={19} />
      </span>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{title}</h3>
          {badge}
        </div>
        {lines.map((line) => (
          <p className={styles[line.tone]} key={line.text}>
            {line.text}
          </p>
        ))}
        {note && <p className={styles.note}>{note}</p>}
      </div>
      <PillBadge tone={status.tone}>{status.label}</PillBadge>
      <Button as={Link} to={to} variant="outline" rightIcon={<Icon as={ArrowRight} size={12} />}>
        {actionLabel}
      </Button>
    </li>
  )
}
