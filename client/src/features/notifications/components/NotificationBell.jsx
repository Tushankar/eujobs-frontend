import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bell, BellOff } from 'lucide-react'
import { Dropdown, Icon, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useGetConfigQuery } from '@/app/api.js'
import { workspacePath } from '@/app/workspaces.js'
import { useGetNotificationsQuery, useNotificationCounts, useReadAllNotificationsMutation } from '../api.js'
import { useOpenNotification } from '../useOpenNotification.js'
import NotificationItem, { NotificationItemSkeleton } from './NotificationItem.jsx'
import styles from './NotificationBell.module.css'

/** The open dropdown: the latest notifications (the server's limit), fetched fresh each time it opens. */
function BellPanel({ workspace, close }) {
  const { t } = useTranslation()
  const latest = useGetConfigQuery().data?.limits.notifications.latest
  const { data, isLoading } = useGetNotificationsQuery({ pageSize: latest }, { skip: !latest, refetchOnMountOrArgChange: true })
  const [readAll] = useReadAllNotificationsMutation()
  const { openItem, isUnavailable } = useOpenNotification(close)
  const items = data?.items ?? []
  return (
    <div className={styles.panel} data-notifications-panel>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('notifications:bell.label')}</h2>
        {data?.unread > 0 && (
          <button type="button" className={styles.textButton} onClick={() => readAll()}>
            {t('notifications:bell.markAllRead')}
          </button>
        )}
      </div>
      {isLoading ? (
        <SkeletonRegion className={styles.list}>
          {[0, 1, 2, 3, 4].map((row) => (
            <NotificationItemSkeleton key={row} compact />
          ))}
        </SkeletonRegion>
      ) : !data ? null : items.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState icon={BellOff} title={t('notifications:bell.empty')} description={t('notifications:bell.emptyText')} />
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <NotificationItem key={item.id} item={item} compact onOpen={openItem} unavailable={isUnavailable(item)} />
          ))}
        </ul>
      )}
      <Link to={workspacePath(workspace, 'notifications')} className={styles.seeAll} onClick={close}>
        {t('notifications:bell.seeAll')}
      </Link>
    </div>
  )
}

/** P11b-Q2: the header bell with the unread count; its dropdown lists the latest 10 and links to the Notifications page. */
export default function NotificationBell({ workspace }) {
  const { t } = useTranslation()
  const { unread } = useNotificationCounts()
  return (
    <Dropdown
      className={styles.root}
      panelClassName={styles.dropdown}
      trigger={(props) => (
        <button type="button" className={styles.bell} data-bell aria-label={unread ? t('notifications:bell.labelUnread', { count: unread }) : t('notifications:bell.label')} {...props}>
          <Icon as={Bell} size={17} />
          {unread > 0 && (
            <span className={styles.count} data-bell-count aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => <BellPanel workspace={workspace} close={close} />}
    </Dropdown>
  )
}
