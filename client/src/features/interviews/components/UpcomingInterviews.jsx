import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, Video } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'
import { joinOpen, useUpcomingInterviews } from '../api.js'
import { useWhen } from '../useWhen.js'
import styles from './UpcomingInterviews.module.css'

/**
 * "Upcoming interviews" on both Applications pages (P11d-Q16): booked interviews whose join window has not closed,
 * soonest first; each row opens its card in the thread, or the call while the window is open. Hidden when there are none.
 */
export default function UpcomingInterviews() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const when = useWhen()
  const { data } = useUpcomingInterviews()
  if (!data?.items.length) return null
  return (
    <Panel className={styles.panel} padding={0} data-upcoming-interviews>
      <h2 className={styles.title}>{t('interviews:upcoming.title')}</h2>
      <ul className={styles.rows}>
        {data.items.map((interview) => {
          const open = joinOpen(interview)
          return (
            <li key={interview.id}>
              <Link
                className={styles.row}
                to={open ? `/${me.role}/interviews/${interview.id}/call` : `/${me.role}/messages/${interview.conversationId}?card=${interview.id}`}
                data-upcoming-interview={interview.id}
              >
                <span className={styles.main}>
                  <span className={styles.name}>{interview.counterpart}</span>
                  <span className={styles.meta}>
                    {interview.job.title} · {t(`enums:interviewMode.${interview.mode}`)}
                  </span>
                </span>
                <span className={styles.when}>{when(interview.startAt, interview.minutes)}</span>
                {open ? (
                  <span className={styles.join}>
                    <Icon as={Video} size={14} /> {t('interviews:card.join')}
                  </span>
                ) : (
                  <Icon as={ChevronRight} size={16} className={styles.chevron} />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
