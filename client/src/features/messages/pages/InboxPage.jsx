import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Skeleton, SkeletonRegion } from '@/components/ui'
import { usePreferences, useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import Counterpart from '../components/Counterpart.jsx'
import { useConversations } from '../api.js'
import styles from './InboxPage.module.css'

/** The inbox while it loads: rows shaped like the threads (logo or photo, name and job, preview, time). */
function InboxSkeleton({ role }) {
  return (
    <SkeletonRegion className={styles.list}>
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className={cx(styles.row, styles.skeletonRow)}>
          <span className={styles.skeletonPerson}>
            <Skeleton shape="circle" width={40} height={40} className={role === 'candidate' ? styles.skeletonLogo : undefined} />
            <span className={styles.skeletonLines}>
              <Skeleton width={140} height={12} />
              <Skeleton width={180} />
            </span>
          </span>
          <span className={styles.preview}>
            <Skeleton width="85%" />
          </span>
          <span className={styles.meta}>
            <Skeleton width={56} />
          </span>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** Messages (§3.5, OD16): every thread of this user, newest first, with the unread count per thread (M-094). */
export default function InboxPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  const { data, isLoading } = useConversations()
  const conversations = data?.items ?? []

  return (
    <div>
      <PageTitle title={t('messages:inbox.title')} description={t(`messages:inbox.description.${me.role}`)} />
      <div className={styles.body}>
        {isLoading ? (
          <InboxSkeleton role={me.role} />
        ) : !data ? null : conversations.length === 0 ? (
          <EmptyState icon={MessageSquare} title={t('messages:inbox.empty')} description={t(`messages:inbox.emptyText.${me.role}`)} />
        ) : (
          <ul className={styles.list} aria-label={t('messages:inbox.title')}>
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to={`/${me.role}/messages/${conversation.id}`}
                  className={cx(styles.row, conversation.unread > 0 && styles.unread)}
                  data-conversation={conversation.id}
                >
                  <Counterpart conversation={conversation} role={me.role} size={40} />
                  {/* §3.23: an interview or document-request event names itself in the reader's language. */}
                  <span className={styles.preview}>{conversation.lastMessageCard ? t(`interviews:preview.${conversation.lastMessageCard}`) : conversation.lastMessagePreview}</span>
                  <span className={styles.meta}>
                    <time dateTime={conversation.lastMessageAt}>{format.relative(conversation.lastMessageAt)}</time>
                    {conversation.unread > 0 && (
                      <span className={styles.count} data-unread={conversation.unread}>
                        {t('messages:inbox.unread', { count: conversation.unread })}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
