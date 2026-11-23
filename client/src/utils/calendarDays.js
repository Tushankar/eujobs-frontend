/*
 * Calendar days as 'YYYY-MM-DD' strings (2026-11-23), computed in UTC so a time zone never shifts a day. Used by the
 * DatePicker and the agency terms (quick lengths, durations).
 */
const pad = (number) => String(number).padStart(2, '0')

export const toKey = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

export function fromKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(key, days) {
  const date = fromKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return toKey(date)
}

/** Today in the browser's own calendar. */
export function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const monthStart = (key) => `${key.slice(0, 7)}-01`

/** The first day of the month `months` away. */
export function addMonths(key, months) {
  const date = fromKey(monthStart(key))
  date.setUTCMonth(date.getUTCMonth() + months)
  return toKey(date)
}

/** The same day `months` away, or that month's last day when it is shorter (31 Jan → 28 Feb). */
export function shiftMonth(key, months) {
  const first = addMonths(key, months)
  const last = addDays(addMonths(first, 1), -1)
  const day = Math.min(Number(key.slice(8)), Number(last.slice(8)))
  return `${first.slice(0, 8)}${pad(day)}`
}

/** Days from `start` to `end`, both counted (the same day is 1). */
export const daysInclusive = (start, end) => Math.round((fromKey(end) - fromKey(start)) / 86_400_000) + 1

/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (key) => (fromKey(key).getUTCDay() + 6) % 7
