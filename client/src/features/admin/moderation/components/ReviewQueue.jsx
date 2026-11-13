import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, MessageSquareQuote } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { Button, Modal, TextareaField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { tableState } from '@/components/common/tableState.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDecideReviewMutation, useGetReviewQueueQuery } from '../api.js'
import { REVIEW_STATUSES, REVIEW_TONES } from '../tones.js'
import { QueueSkeleton } from './QueueRow.jsx'
import pageStyles from '../pages/ModerationPage.module.css'
import styles from './ReviewQueue.module.css'

/**
 * Moderation › Reviews (2026-11-13): user reviews for the public home page, newest first. Approving shows a review on
 * the landing page; rejecting can carry a note the author sees in Settings. Any approved review can be withdrawn.
 */
export default function ReviewQueue({ status, onStatusChange, onDecided }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const result = useGetReviewQueueQuery(status)
  const { data: queue, error } = result
  const list = tableState(result, queue?.items ?? [])
  const denied = errorCode(error) === 'PERMISSION_DENIED'
  const [decide, { isLoading: deciding }] = useDecideReviewMutation()
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState(null)

  async function run(review, action, note = '') {
    setFailure(null)
    try {
      await decide({ id: review.id, action, reason: note }).unwrap()
      onDecided(t(`moderation:reviews.done.${action}`, { name: review.author?.name ?? t('moderation:reviews.deleted') }))
      setRejecting(null)
      setReason('')
    } catch (failed) {
      setFailure(errorText.code(failed))
    }
  }

  return (
    <>
      <section className={pageStyles.queue} role="tabpanel" aria-label={t('moderation:reviews.title')}>
        <div className={pageStyles.header}>
          <SectionTitle title={t('moderation:reviews.title')} description={t('moderation:reviews.description')} />
          {!denied && (
            <SegmentedTabs
              className={pageStyles.filter}
              label={t('moderation:reviews.statusFilter')}
              tabs={REVIEW_STATUSES.map((id) => ({ id, label: `${t(`moderation:reviews.status.${id}`)} (${queue?.counts[id] ?? 0})` }))}
              value={status}
              onChange={onStatusChange}
            />
          )}
        </div>
        {failure && !rejecting && (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        )}
        {list.loading ? (
          <QueueSkeleton />
        ) : denied ? (
          <EmptyState icon={Lock} title={t('errors:PERMISSION_DENIED')} description={t('moderation:verification.noPermission', error.data.error.params)} />
        ) : queue?.items.length === 0 ? (
          <EmptyState icon={MessageSquareQuote} title={t(`moderation:reviews.empty.${status}`)} />
        ) : (
          <ul className={cx(styles.list, list.busy && pageStyles.busy)} aria-busy={list.busy || undefined}>
            {queue?.items.map((review) => (
              <li key={review.id} className={styles.item}>
                <div className={styles.head}>
                  <span className={styles.stars} role="img" aria-label={t('landing:reviews.rating', { value: review.rating })}>
                    {'★'.repeat(review.rating)}
                    <span className={styles.starsOff}>{'★'.repeat(5 - review.rating)}</span>
                  </span>
                  <PillBadge tone={REVIEW_TONES[review.status]}>{t(`moderation:reviews.status.${review.status}`)}</PillBadge>
                </div>
                <p className={styles.text}>“{review.text}”</p>
                <p className={styles.author}>
                  <strong>{review.author?.name ?? t('moderation:reviews.deleted')}</strong>
                  {review.author && (
                    <span>
                      {[t(`enums:role.${review.author.role}`), review.author.title, review.author.email].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <span>{t('moderation:reviews.submitted', { date: format.dateTime(review.submittedAt) })}</span>
                </p>
                {review.reason && <p className={styles.reason}>{t('moderation:reviews.reason', { reason: review.reason })}</p>}
                <div className={styles.actions}>
                  {review.status !== 'rejected' && (
                    <Button variant="outline" onClick={() => setRejecting(review)}>
                      {t(review.status === 'approved' ? 'moderation:reviews.withdraw' : 'moderation:reviews.reject')}
                    </Button>
                  )}
                  {review.status !== 'approved' && (
                    <Button onClick={() => run(review, 'approve')} loading={deciding}>
                      {t('moderation:reviews.approve')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t('moderation:reviews.rejectTitle')}
        width={480}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              {t('common:cancel')}
            </Button>
            <Button variant="danger" loading={deciding} onClick={() => run(rejecting, 'reject', reason.trim())}>
              {t('moderation:reviews.reject')}
            </Button>
          </>
        }
      >
        <TextareaField label={t('moderation:reviews.reasonLabel')} hint={t('moderation:reviews.reasonHint')} rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
        {failure && (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        )}
      </Modal>
    </>
  )
}
