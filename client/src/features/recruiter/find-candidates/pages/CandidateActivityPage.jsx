import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetCandidateActivityQuery } from '../api.js'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateActivityPage.module.css'

const SKELETON_EVENTS = 4

/** Activity tab (M-081): the company-wide timeline, stored as type + params and translated here. */
export default function CandidateActivityPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { candidate } = useOutletContext()
  const { data, isLoading } = useGetCandidateActivityQuery(candidate.id)
  const events = data?.items ?? []

  function describe(event) {
    const actor = event.actor?.name ?? t('discovery:activityTab.candidate')
    const key = event.type === 'cv_request_decided' ? `cv_request_decided_${event.params.decision}` : event.type
    const reason = event.params.reason && t(`enums:cvRequestReason.${event.params.reason}`).toLocaleLowerCase()
    // §3.23: an interview's time in the reader's zone and its outcome in their language.
    const when = event.params.startAt && format.dateTime(event.params.startAt)
    const result = event.params.result && t(`enums:interviewOutcome.${event.params.result}`)
    return t(`discovery:activityTab.events.${key}`, { ...event.params, actor, reason, when, result })
  }

  return (
    <ProfileSection labelledBy="activity-title">
      <SectionTitle id="activity-title" title={t('discovery:activityTab.title')} />
      {isLoading && (
        <SkeletonRegion className={styles.list}>
          {Array.from({ length: SKELETON_EVENTS }, (_, index) => (
            <div key={index} className={styles.event}>
              <span className={styles.eventText}>
                <Skeleton shape="circle" width={14} height={14} />
                <Skeleton width={[260, 220, 300, 200][index]} />
              </span>
              <Skeleton width={110} />
            </div>
          ))}
        </SkeletonRegion>
      )}
      {data && events.length === 0 && <p className={styles.empty}>{t('discovery:activityTab.empty')}</p>}
      {events.length > 0 && (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={styles.event} data-activity={event.type}>
              <span className={styles.eventText}>
                <Icon as={CircleCheck} size={14} strokeWidth={2} className={styles.icon} />
                {describe(event)}
              </span>
              <time className={styles.time} dateTime={event.at}>
                {format.dateTime(event.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  )
}
