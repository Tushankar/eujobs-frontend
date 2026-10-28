const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "Sep 30, 2026" from an ISO date-time string. */
export function formatDate(iso) {
  return DATE.format(new Date(iso))
}

/** "Sep 30, 2026, 9:15 AM" from an ISO date-time string. */
export function formatDateTime(iso) {
  return DATE_TIME.format(new Date(iso))
}
