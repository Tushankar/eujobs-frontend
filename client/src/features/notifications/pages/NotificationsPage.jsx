import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BellOff, CheckCheck } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetNotificationsQuery, useNotificationCounts, useReadAllNotificationsMutation } from '../api.js'
import NotificationItem from '../components/NotificationItem.jsx'
import { useOpenNotification } from '../useOpenNotification.js'
import styles from './NotificationsPage.module.css'

/**
 * Notifications (P11b-Q2), the same page in every workspace: All / Unread, "Mark all as read", newest first, the
 * server's page size. It refreshes when the counters poll sees the unread number change.
 */
export default function NotificationsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { unread } = useNotificationCounts()
  const { data, refetch } = useGetNotificationsQuery({ filter, page })
  const [readAll, { isLoading }] = useReadAllNotificationsMutation()
  const { openItem, isUnavailable } = useOpenNotification()

  useEffect(() => {
    refetch()
  }, [unread, refetch])

  const items = data?.items ?? []
  const changeFilter = (value) => {
    setFilter(value)
    setPage(1)
  }

  return (
    <>
      <PageTitle
        title={t('shell:titles.notifications')}
        description={t('notifications:page.description')}
        actions={
          data?.unread > 0 && (
            <Button variant="outline" leftIcon={<Icon as={CheckCheck} size={15} />} loading={isLoading} onClick={() => readAll()}>
              {t('notifications:bell.markAllRead')}
            </Button>
          )
        }
      />
      <FilterChips
        className={styles.filters}
        label={t('notifications:page.filters')}
        options={[
          { id: 'all', label: t('notifications:page.all') },
          { id: 'unread', label: data ? `${t('notifications:page.unread')} (${format.number(data.unread)})` : t('notifications:page.unread') },
        ]}
        value={filter}
        onChange={changeFilter}
      />
      {!data ? null : items.length === 0 ? (
        <EmptyState
          size="lg"
          icon={BellOff}
          title={t(filter === 'unread' ? 'notifications:page.emptyUnread' : 'notifications:page.empty')}
          description={t(filter === 'unread' ? 'notifications:page.emptyUnreadText' : 'notifications:page.emptyText')}
        />
      ) : (
        <Panel padding={0} className={styles.card}>
          <ul className={styles.list} aria-label={t('shell:titles.notifications')}>
            {items.map((item) => (
              <NotificationItem key={item.id} item={item} onOpen={openItem} unavailable={isUnavailable(item)} />
            ))}
          </ul>
        </Panel>
      )}
      {data && data.total > data.pageSize && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
