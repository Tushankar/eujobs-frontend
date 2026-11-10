/*
 * iCalendar invites (RFC 5545) for interviews (§3.23, P11d-Q4): METHOD REQUEST for a booked time, CANCEL when it is
 * cancelled or released by a reschedule. One UID per interview; SEQUENCE grows with every change, so calendars update
 * the same event. Times are UTC.
 */
const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escapeText = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Folds a content line at 75 octets (RFC 5545 §3.1), never inside a UTF-8 character. */
function fold(line) {
  const parts = []
  let current = ''
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
    }
    current += char
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** The address inside "Name <address>" (or the value itself). */
export const addressOf = (from) => from.match(/<([^>]+)>/)?.[1] ?? from

export function buildIcs({ method, uid, sequence, startAt, minutes, summary, description, location, url, organizer, attendee, now = new Date() }) {
  const endAt = new Date(startAt.getTime() + minutes * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EU Jobs//Interviews//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(startAt)}`,
    `DTEND:${stamp(endAt)}`,
    `SUMMARY:${escapeText(summary)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    location ? `LOCATION:${escapeText(location)}` : null,
    url ? `URL:${url}` : null,
    `ORGANIZER:mailto:${organizer}`,
    attendee ? `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${attendee}` : null,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.filter(Boolean).map(fold).join('\r\n')}\r\n`
}
