import { browserTimeZone } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetActivityQuery } from './api.js'

export const PERIODS = ['this_week', 'last_week', 'last_month']

/**
 * Registrations and applications per day (a week) or per ISO week (last month) in the browser time zone (M-170,
 * M-171), as chart series: { labels, registrations, applications }, or null while loading. `source` is the page.
 */
export function useActivity(source, period, country) {
  const format = useFormat()
  const { data } = useGetActivityQuery({ source, period, tz: browserTimeZone(), ...(country && { country }) }, { refetchOnMountOrArgChange: true })
  if (!data || data.period !== period) return null
  // Noon keeps the calendar day whatever the offset.
  const label = ({ start }) => format.date(`${start}T12:00:00`, data.unit === 'day' ? { weekday: 'short' } : { day: 'numeric', month: 'short' })
  return {
    labels: data.buckets.map(label),
    registrations: data.buckets.map((bucket) => bucket.registrations),
    applications: data.buckets.map((bucket) => bucket.applications),
  }
}
