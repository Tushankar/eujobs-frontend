import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import styles from './QueueRow.module.css'

/* Title and sub-line widths (px) of the placeholder rows. */
const SKELETON_WIDTHS = [
  [160, 280],
  [128, 240],
  [176, 300],
]

/** A queue's rows while it loads: tile, title with badge, two lines, the status and the review button. */
export function QueueSkeleton() {
  return (
    <SkeletonRegion>
      <ul>
        {SKELETON_WIDTHS.map(([title, sub], index) => (
          <li key={index} className={styles.row}>
            <Skeleton shape="block" width={44} height={44} className={styles.skeletonTile} />
            <div className={styles.body}>
              <div className={styles.titleRow}>
                <span className={styles.title}>
                  <Skeleton width={title} height={14} />
                </span>
                <Skeleton shape="pill" width={64} />
              </div>
              <p className={styles.sub}>
                <Skeleton width={sub} />
              </p>
              <p className={styles.meta}>
                <Skeleton width={120} height={8} />
              </p>
            </div>
            <Skeleton shape="pill" />
            <Skeleton shape="pill" width={96} height={40} />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

/**
 * One moderation queue item: icon tile, headline with optional badge, supporting lines, status badge and
 * a link into the review dialog. `lines` = [{ text, tone: 'sub' | 'summary' | 'meta' }]. `media` (a logo or photo)
 * replaces the icon tile.
 */
export default function QueueRow({ icon, media, alert = false, title, badge, lines, status, note, actionLabel, to }) {
  return (
    <li className={styles.row}>
      {media ?? (
        <span className={cx(styles.tile, alert && styles.alert)}>
          <Icon as={icon} size={19} />
        </span>
      )}
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
