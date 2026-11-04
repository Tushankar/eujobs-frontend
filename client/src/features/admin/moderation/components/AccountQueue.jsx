import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Lock, Users } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetAccountQueueQuery } from '../api.js'
import { ACCOUNT_STATUSES, ACCOUNT_TONES } from '../tones.js'
import AccountReview from './AccountReview.jsx'
import QueueRow from './QueueRow.jsx'
import pageStyles from '../pages/ModerationPage.module.css'

/** Moderation › Account review (M-165, OQ-2, P4-Q2): recruiters by status, pending oldest first, and the review dialog. */
export default function AccountQueue({ basePath, openId, status, onStatusChange, onDecided }) {
  const { t } = useTranslation()
  const format = useFormat()
  const navigate = useNavigate()
  const { data: queue, error } = useGetAccountQueueQuery(status)
  const denied = errorCode(error) === 'PERMISSION_DENIED'

  return (
    <>
      <section className={pageStyles.queue} role="tabpanel" aria-label={t('moderation:accounts.title')}>
        <div className={pageStyles.header}>
          <SectionTitle title={t('moderation:accounts.title')} description={t('moderation:accounts.description')} />
          {!denied && (
            <SegmentedTabs
              className={pageStyles.filter}
              label={t('moderation:accounts.statusFilter')}
              tabs={ACCOUNT_STATUSES.map((id) => ({ id, label: t(`moderation:accounts.status.${id}`) }))}
              value={status}
              onChange={onStatusChange}
            />
          )}
        </div>
        {denied ? (
          <EmptyState icon={Lock} title={t('errors:PERMISSION_DENIED')} description={t('moderation:verification.noPermission', error.data.error.params)} />
        ) : queue?.items.length === 0 ? (
          <EmptyState icon={Users} title={t('moderation:accounts.empty')} />
        ) : (
          <ul className={pageStyles.list}>
            {queue?.items.map((item) => (
              <QueueRow
                key={item.id}
                icon={Users}
                title={item.fullName}
                lines={[
                  { text: [item.email, item.company?.legalName, item.company?.countryCode && format.country(item.company.countryCode)].filter(Boolean).join(' · '), tone: 'sub' },
                  {
                    text: item.submittedAt ? t('moderation:accounts.submitted', { date: format.dateTime(item.submittedAt) }) : t('moderation:accounts.joined', { date: format.date(item.createdAt) }),
                    tone: 'meta',
                  },
                ]}
                status={{ tone: ACCOUNT_TONES[item.status], label: t(`moderation:accounts.status.${item.status}`) }}
                actionLabel={t('moderation:accounts.review')}
                to={`${basePath}/${item.id}`}
              />
            ))}
          </ul>
        )}
      </section>
      {openId && <AccountReview userId={openId} onDecided={onDecided} onClose={() => navigate(basePath)} />}
    </>
  )
}
