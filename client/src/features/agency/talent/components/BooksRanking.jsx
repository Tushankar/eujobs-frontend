import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { hiringPath } from '@/app/roles.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Avatar, Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import MatchBadge from '@/features/candidate/jobs/components/MatchBadge.jsx'
import { MessageCandidateButton } from '@/features/messages/components/StartConversation.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetTalentRankingQuery, useOfferPlacementMutation, useTalentReasonsMutation } from '../../api.js'
import styles from './BooksRanking.module.css'

const STATE_TONE = { offered: 'info', placed: 'success' }

function RankingSkeleton() {
  return (
    <SkeletonRegion className={styles.list}>
      {[0, 1, 2].map((key) => (
        <div key={key} className={styles.row}>
          <Skeleton shape="circle" width={40} height={40} />
          <div className={styles.text}>
            <Skeleton width={150} height={14} />
            <Skeleton width={220} height={12} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** One person: who, the match, the AI reason once asked, and Offer placement + Message while they are free. */
function RankingRow({ item, job, reason, onOffer }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { candidate } = item
  const place = candidate.location && t('common:city.value', { city: candidate.location.city, country: format.country(candidate.location.countryCode) })
  const canOffer = item.state === 'free' && !item.needsAgreement && job.status === 'published'
  return (
    <li className={styles.row} data-ranked={candidate.name}>
      <Avatar name={candidate.name ?? ''} size={40} />
      <div className={styles.text}>
        <Link to={hiringPath(`find-candidates/${candidate.id}?jobId=${job.id}`)} className={styles.name}>
          {candidate.name ?? t('common:deletedUser')}
        </Link>
        <span className={styles.meta}>{[candidate.headline, place].filter(Boolean).join(' · ') || t('agency:talent.noDetails')}</span>
      </div>
      <div className={styles.badges}>
        <MatchBadge job={item} />
        {item.state !== 'free' && <PillBadge tone={STATE_TONE[item.state]}>{t(`agency:ranking.state.${item.state}`)}</PillBadge>}
        {item.state === 'free' && item.needsAgreement && <PillBadge tone="warning">{t('agency:talent.newVersionWaiting')}</PillBadge>}
      </div>
      <div className={styles.actions}>
        {item.state === 'free' && (
          <Button size="sm" disabled={!canOffer} onClick={() => onOffer(item)} data-offer-placement>
            {t('agency:ranking.offer')}
          </Button>
        )}
        {candidate.name && <MessageCandidateButton candidate={{ id: candidate.id, fullName: candidate.name, canStartConversation: true }} job={job} onBooks size="sm" fullWidth={false} />}
      </div>
      {/* 2026-11-23 (owner: "show the AI summary in each"): its own labelled box across the row, once AI reasons ran. */}
      {reason && (
        <div className={styles.summary} data-ranked-reason>
          <span className={styles.summaryLabel}>
            <Icon as={Sparkles} size={13} />
            {t('agency:ranking.aiSummary')}
          </span>
          <p className={styles.summaryText}>{reason}</p>
        </div>
      )}
    </li>
  )
}

/**
 * Phase 6 (owner 2026-11-23): the agency's on-books talent for one agency job, best match first (every plan). People
 * whose placements block the job's dates are only counted; "AI reasons" (Agency Plus) adds a line per person.
 * `inJob` lays it out inside the job page's card.
 */
export default function BooksRanking({ jobId, inJob = false }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data, isLoading } = useGetTalentRankingQuery(jobId)
  const [askReasons, reasons] = useTalentReasonsMutation()
  const [offerPlacement] = useOfferPlacementMutation()
  const [offer, setOffer] = useState(null)
  const [failure, setFailure] = useState(null)
  const items = data?.items ?? []
  const job = data?.job
  const reasonOf = new Map((reasons.data?.items ?? []).map((item) => [item.membershipId, item.reason]))
  const free = items.filter((item) => item.state === 'free').length

  async function sendOffer() {
    setFailure(null)
    try {
      await offerPlacement({ jobId, candidateId: offer.candidate.id }).unwrap()
      setOffer(null)
    } catch (error) {
      setOffer(null)
      setFailure(error)
    }
  }

  return (
    <section className={inJob ? styles.inJob : styles.card} aria-labelledby={`books-ranking-${jobId}`} data-books-ranking>
      <div className={styles.head}>
        <h3 id={`books-ranking-${jobId}`} className={styles.title}>
          {t('agency:ranking.title')}
        </h3>
        {free > 0 && (
          <AiButton variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={13} />} loading={reasons.isLoading} onClick={() => askReasons(jobId).catch(() => {})} data-ranking-reasons>
            {t('agency:ranking.reasons')}
          </AiButton>
        )}
      </div>
      <p className={styles.note}>{t('agency:ranking.text')}</p>
      <AiStatus isLoading={false} error={reasons.error} onRetry={() => askReasons(jobId).catch(() => {})}>
        {reasons.data && <p className={styles.note}>{t('agency:ranking.disclaimer')}</p>}
      </AiStatus>
      {job && job.status !== 'published' && items.length > 0 && <p className={styles.note}>{t('agency:ranking.publishFirst')}</p>}
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
      {isLoading || !data ? (
        <RankingSkeleton />
      ) : items.length === 0 ? (
        <p className={styles.empty}>
          {data.hidden ? t('agency:ranking.allBusy') : t('agency:ranking.empty')}{' '}
          {!data.hidden && <Link to={hiringPath('talent')}>{t('agency:ranking.openTalent')}</Link>}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <RankingRow key={item.membershipId} item={item} job={job} reason={reasonOf.get(item.membershipId)} onOffer={setOffer} />
          ))}
        </ul>
      )}
      {data?.hidden > 0 && items.length > 0 && (
        <p className={styles.note} data-ranking-hidden>
          {t('agency:ranking.hidden', { count: data.hidden })}
        </p>
      )}
      <ConfirmDialog
        open={Boolean(offer)}
        title={t('agency:ranking.offerTitle', { name: offer?.candidate.name, job: job?.title })}
        description={job ? t('agency:ranking.offerText', { start: format.date(job.startDate), end: format.date(job.endDate) }) : ''}
        confirmLabel={t('agency:placements.sendOffer')}
        onConfirm={sendOffer}
        onClose={() => setOffer(null)}
      />
    </section>
  )
}
