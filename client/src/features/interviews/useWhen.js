import { useTranslation } from 'react-i18next'
import { useFormat, usePreferences } from '@/lib/preferences.js'

/**
 * "12 Nov 2026, 10:00 am GMT+5:30 · 45 min" in the viewer's time zone, labelled (P11d-Q3), then the other side's local time
 * when their clock reads differently: "· Interviewer: 2:30 PM GMT+5:30" (owner 2026-11-17).
 */
export function useWhen() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const format = useFormat()
  return (startAt, minutes, otherTimeZone) => {
    const text = `${format.dateTime(startAt, { zone: true })} · ${t('interviews:minutes', { count: minutes })}`
    const other = otherTimeZone && format.otherZone(startAt, otherTimeZone)
    return other ? `${text} · ${t(`interviews:otherTime.${me?.role === 'recruiter' ? 'recruiter' : 'candidate'}`, { time: other })}` : text
  }
}
