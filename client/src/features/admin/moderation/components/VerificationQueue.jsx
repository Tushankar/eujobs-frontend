import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { tableState } from '@/components/common/tableState.js'
import { cx } from '@/utils/cx.js'
import { useGetVerificationQueueQuery } from '../api.js'
import CandidateSubmissions, { SubmissionsSkeleton } from './CandidateSubmissions.jsx'
import VerificationReview from './VerificationReview.jsx'
import pageStyles from '../pages/ModerationPage.module.css'

const STATUSES = ['in_review', 'approved', 'rejected']

/** The queue (oldest first) grouped per candidate; a candidate sits where their oldest submission was. */
function byCandidate(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.candidate?.id ?? item.id
    if (!groups.has(key)) groups.set(key, { key, candidate: item.candidate, items: [] })
    groups.get(key).items.push(item)
  }
  return [...groups.values()]
}

/** Moderation › Candidate verification (M-166, P3-D8): the server queue, oldest first, and the review dialog. */
export default function VerificationQueue({ basePath, openId, onDecided }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('in_review')
  const result = useGetVerificationQueueQuery(status)
  const { data: queue, error } = result
  const list = tableState(result, queue?.items ?? [])
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
        {list.loading ? (
          <SubmissionsSkeleton />
        ) : denied ? (
          <EmptyState icon={Lock} title={t('errors:PERMISSION_DENIED')} description={t('moderation:verification.noPermission', error.data.error.params)} />
        ) : queue?.items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('moderation:verification.empty')} />
        ) : (
          <ul className={cx(pageStyles.list, list.busy && pageStyles.busy)} aria-busy={list.busy || undefined}>
            {byCandidate(queue?.items ?? []).map((group) => (
              <CandidateSubmissions key={group.key} candidate={group.candidate} items={group.items} basePath={basePath} />
            ))}
          </ul>
        )}
      </section>
      {openId && <VerificationReview id={openId} onDecided={onDecided} onClose={() => navigate(basePath)} />}
    </>
  )
}
