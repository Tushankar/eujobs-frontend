import { useTranslation } from 'react-i18next'
import { useFormat } from '@/lib/preferences.js'

/** "Tue 12 Nov 2026, 10:00 · 45 min" in the viewer's time zone (P11d-Q3). */
export function useWhen() {
  const { t } = useTranslation()
  const format = useFormat()
  return (startAt, minutes) => `${format.dateTime(startAt)} · ${t('interviews:minutes', { count: minutes })}`
}
