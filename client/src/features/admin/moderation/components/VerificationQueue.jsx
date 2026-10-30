import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetVerificationQueueQuery } from '../api.js'
import QueueRow from './QueueRow.jsx'
import VerificationReview from './VerificationReview.jsx'
import pageStyles from '../pages/ModerationPage.module.css'

const STATUSES = ['in_review', 'approved', 'rejected']
const STATUS_TONES = { in_review: 'warning', approved: 'success', rejected: 'danger' }

/** Moderation › Candidate verification (M-166, P3-D8): the server queue, oldest first, and the review dialog. */
export default function VerificationQueue({ basePath, openId, onDecided }) {
  const { t } = useTranslation()
  const format = useFormat()
  const navigate = useNavigate()
  const [status, setStatus] = useState('in_review')
  const { data: queue, error } = useGetVerificationQueueQuery(status)
  const denied = errorCode(error) === 'PERMISSION_DENIED'

  return (
    <>
      <section className={pageStyles.queue} role="tabpanel" aria-label={t('moderation:verification.title')}>
        <div className={pageStyles.header}>
          <SectionTitle title={t('moderation:verification.title')} description={t('moderation:verification.description')} />
          {!denied && (
            <SegmentedTabs
              className={pageStyles.filter}
              label={t('moderation:verification.statusFilter')}
              tabs={STATUSES.map((id) => ({ id, label: t(`enums:verificationStatus.${id}`) }))}
              value={status}
              onChange={setStatus}
            />
          )}
        </div>
        {denied ? (
          <EmptyState icon={Lock} title={t('errors:PERMISSION_DENIED')} description={t('moderation:verification.noPermission', error.data.error.params)} />
        ) : queue?.items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('moderation:verification.empty')} />
        ) : (
          <ul className={pageStyles.list}>
            {queue?.items.map((item) => (
              <QueueRow
                key={item.id}
                icon={ShieldCheck}
                title={item.candidate?.fullName ?? ''}
                lines={[
                  {
                    text: [t(`enums:verificationCategory.${item.category}`), item.evidenceType && t(`enums:evidenceType.${item.evidenceType}`)].filter(Boolean).join(' · '),
                    tone: 'sub',
                  },
                  { text: t('moderation:verification.submitted', { date: format.dateTime(item.submittedAt) }), tone: 'meta' },
                ]}
                status={{ tone: STATUS_TONES[item.status], label: t(`enums:verificationStatus.${item.status}`) }}
                actionLabel={t('moderation:verification.review')}
                to={`${basePath}/${item.id}`}
              />
            ))}
          </ul>
        )}
      </section>
      {openId && <VerificationReview id={openId} onDecided={onDecided} onClose={() => navigate(basePath)} />}
    </>
  )
}
