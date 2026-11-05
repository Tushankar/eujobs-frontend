import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetContentCasesQuery } from '../api.js'
import { CASE_TONES } from '../tones.js'
import ContentReview from './ContentReview.jsx'
import QueueRow, { QueueSkeleton } from './QueueRow.jsx'
import pageStyles from '../pages/ModerationPage.module.css'

/** Moderation › Content (M-164, M-167, P10-Q10): open cases first, then decided ones, and the review dialog. */
export default function ContentQueue({ basePath, openId, onDecided }) {
  const { t } = useTranslation(['moderation', 'enums'])
  const format = useFormat()
  const navigate = useNavigate()
  const { data: cases, isLoading } = useGetContentCasesQuery()
  return (
    <>
      <section className={pageStyles.queue} role="tabpanel" aria-label={t('content.title')}>
        <div className={pageStyles.header}>
          <SectionTitle title={t('content.title')} description={t('content.description')} />
        </div>
        {isLoading ? (
          <QueueSkeleton />
        ) : cases?.items.length === 0 ? (
          <EmptyState icon={TriangleAlert} title={t('content.empty')} />
        ) : (
          <ul className={pageStyles.list}>
            {cases?.items.map((item) => (
              <QueueRow
                key={item.id}
                icon={TriangleAlert}
                alert={item.status === 'open' && item.priority === 'high'}
                title={item.targetName ?? ''}
                badge={<PillBadge tone={item.priority === 'high' ? 'warning' : 'neutral'}>{t(`content.priority.${item.priority}`)}</PillBadge>}
                lines={[
                  {
                    text: [t(`enums:reportTargetType.${item.targetType}`), format.list(item.reasons.map((reason) => t(`enums:reportReason.${reason}`)))].join(' · '),
                    tone: 'sub',
                  },
                  ...(item.latestDetails ? [{ text: item.latestDetails, tone: 'summary' }] : []),
                  {
                    text: `${item.openedBy === 'admin' ? t('content.openedFromJobs') : t('content.reportCount', { count: item.reportCount })} · ${format.dateTime(item.reportedAt)}`,
                    tone: 'meta',
                  },
                ]}
                status={{ tone: CASE_TONES[item.status], label: t(`enums:caseStatus.${item.status}`) }}
                note={item.decision?.reason ? t('content.decisionNote', { reason: item.decision.reason }) : null}
                actionLabel={t('content.review')}
                to={`${basePath}/content/${item.id}`}
              />
            ))}
          </ul>
        )}
      </section>
      {openId && (
        <ContentReview
          id={openId}
          onDecided={(message) => {
            onDecided(message)
            navigate(basePath)
          }}
          onClose={() => navigate(basePath)}
        />
      )}
    </>
  )
}
