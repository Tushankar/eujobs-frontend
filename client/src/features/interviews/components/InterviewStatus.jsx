import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './InterviewStatus.module.css'

/**
 * The application's latest interview on a pipeline card, the candidate panel or an Applications row (owner answer
 * P11d-A6): "Times offered", "Booked · Tue 12 Nov, 10:00" or the outcome. Nothing when there is none.
 */
export default function InterviewStatus({ interview, className }) {
  const { t } = useTranslation()
  const format = useFormat()
  if (!interview) return null
  const text =
    interview.status === 'confirmed'
      ? t('interviews:status.booked', { when: format.dateTime(interview.startAt) })
      : interview.status === 'completed' && interview.outcome
        ? t('interviews:status.outcome', { outcome: t(`enums:interviewOutcome.${interview.outcome}`) })
        : t(`enums:interviewStatus.${interview.status}`)
  return (
    <p className={cx(styles.status, className)} data-interview-status-line={interview.status}>
      <Icon as={CalendarClock} size={12} />
      <span>{text}</span>
    </p>
  )
}
