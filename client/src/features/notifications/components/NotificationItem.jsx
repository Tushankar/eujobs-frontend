import { useTranslation } from 'react-i18next'
import { Icon, Skeleton } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { NOTIFICATION_ICONS, useNotificationText } from '../notificationText.js'
import styles from './NotificationItem.module.css'

/** A notification while the list loads: the icon, the sentence and its type and time as placeholders. */
export function NotificationItemSkeleton({ compact = false }) {
  return (
    <div className={cx(styles.row, compact && styles.compact, styles.skeleton)}>
      <Skeleton shape="circle" width={18} height={18} className={styles.icon} />
      <span className={styles.body}>
        <span className={styles.text}>
          <Skeleton width="85%" />
        </span>
        <span className={styles.meta}>
          <Skeleton width={120} />
        </span>
      </span>
    </div>
  )
}

/** One notification: a grey icon, the sentence (bold while unread), its type and time, and an unread dot. */
export default function NotificationItem({ item, onOpen, unavailable, compact = false }) {
  const { t } = useTranslation()
  const format = useFormat()
  const text = useNotificationText()
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={cx(styles.row, compact && styles.compact, !item.read && styles.unread)}
        onClick={() => onOpen(item)}
        data-notification={item.type}
        data-read={item.read || undefined}
      >
        <Icon as={NOTIFICATION_ICONS[item.type]} size={18} className={styles.icon} />
        <span className={styles.body}>
          <span className={styles.text}>{text(item)}</span>
          <span className={styles.meta}>
            {t(`enums:notificationType.${item.type}`)} · <time dateTime={item.at}>{format.relative(item.at)}</time>
          </span>
          {unavailable && (
            <span className={styles.unavailable} role="status">
              {t('notifications:unavailable')}
            </span>
          )}
        </span>
        {!item.read && (
          <span className={styles.dot}>
            <span className="sr-only">{t('notifications:unreadMark')}</span>
          </span>
        )}
      </button>
    </li>
  )
}
