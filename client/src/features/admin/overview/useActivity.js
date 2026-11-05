import { browserTimeZone } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetActivityQuery } from './api.js'

export const PERIODS = ['this_week', 'last_week', 'last_month']

/**
 * Registrations and applications per day (a week) or per ISO week (last month) in the browser time zone (M-170,
 * M-171), as chart series `data`: { labels, registrations, applications }, or null until the period's counts arrive.
 * `loading` while they are on their way; `busy` while the series shown belong to the previous country. `source` is the page.
 */
export function useActivity(source, period, country) {
  const format = useFormat()
  const { data, isFetching, currentData } = useGetActivityQuery({ source, period, tz: browserTimeZone(), ...(country && { country }) }, { refetchOnMountOrArgChange: true })
  if (!data || data.period !== period) return { data: null, loading: isFetching, busy: false }
  // Noon keeps the calendar day whatever the offset.
  const label = ({ start }) => format.date(`${start}T12:00:00`, data.unit === 'day' ? { weekday: 'short' } : { day: 'numeric', month: 'short' })
  return {
    data: {
      labels: data.buckets.map(label),
      registrations: data.buckets.map((bucket) => bucket.registrations),
      applications: data.buckets.map((bucket) => bucket.applications),
    },
    loading: false,
    busy: isFetching && !currentData,
  }
}
