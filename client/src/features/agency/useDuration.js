import { useTranslation } from 'react-i18next'
import { daysInclusive } from '@/utils/calendarDays.js'

/** 2026-11-23: "4 weeks 2 days" for the days from `start` to `end` ('YYYY-MM-DD', both counted); '' when not set. */
export function useDuration() {
  const { t } = useTranslation()
  return (start, end) => {
    if (!start || !end || end < start) return ''
    const days = daysInclusive(start, end)
    const weeks = Math.floor(days / 7)
    const rest = days % 7
    return [weeks && t('agency:terms.duration.weeks', { count: weeks }), rest && t('agency:terms.duration.days', { count: rest })].filter(Boolean).join(' ')
  }
}
