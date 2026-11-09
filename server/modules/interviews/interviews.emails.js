import { DateTime } from 'luxon'
import { config } from '../../config/env.js'
import { interpolate, t } from '../../lib/i18n.js'
import { addressOf, buildIcs } from '../../lib/ics.js'
import { sendEmail } from '../../lib/mailer.js'

/*
 * Interview and document-request emails (§3.23, P11d-Q4, Q21): times in the recipient's saved time zone (U12) with
 * the zone named, the item link, and for booked times a calendar invite (REQUEST) or its cancellation (CANCEL).
 */
const LOCALE = { en: 'en-IE', es: 'es-ES', fr: 'fr-FR' }
const label = (language, key, params = {}) => interpolate(t(language, `labels.interview.${key}`), params)

/** "Tuesday 12 November 2026, 10:00 CET · 45 min" in the recipient's zone and language. */
export function formatWhen(user, startAt, minutes) {
  const language = user.language ?? 'en'
  const when = DateTime.fromJSDate(startAt, { zone: user.timezone || 'UTC' })
    .setLocale(LOCALE[language])
    .toLocaleString({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  return `${when} · ${label(language, 'minutes', { n: minutes })}`
}

/** How the interview takes place, for this recipient: the app call, the phone, the address or the external link. */
export function detailsLine(user, interview, { phone, candidateName } = {}) {
  const language = user.language ?? 'en'
  if (interview.mode === 'phone') {
    return user.role === 'recruiter' ? label(language, 'details.phone_recruiter', { candidate: candidateName, phone: phone ?? '' }) : label(language, 'details.phone_candidate')
  }
  return label(language, `details.${interview.mode}`, { address: interview.address ?? '', link: interview.link ?? '' })
}

export const itemLink = (role, kind, id) => `${config.clientOrigin}/${role}/${kind}/${id}`

/** The calendar entry of the booked time for this reader: `{ method, content }` (REQUEST, CANCEL or PUBLISH). */
export function calendarInvite(user, interview, method, { company, job, candidateName, phone, details = detailsLine(user, interview, { phone, candidateName }) }) {
  const language = user.language ?? 'en'
  const link = itemLink(user.role, 'interviews', interview._id)
  return {
    method,
    content: buildIcs({
      method,
      uid: `interview-${interview._id}@localworkman`,
      sequence: interview.sequence,
      startAt: interview.startAt,
      minutes: interview.minutes,
      summary: label(language, 'summary', { job, company }),
      description: `${details}\n${link}`,
      location: interview.mode === 'in_person' ? interview.address : interview.mode === 'link' ? interview.link : link,
      url: link,
      organizer: addressOf(config.mailFrom),
      attendee: method === 'PUBLISH' ? null : user.email,
    }),
  }
}

/**
 * One email to `user` (a user document). `interview` adds the time and how it happens; `ical` (REQUEST or CANCEL)
 * attaches the invite of the interview's booked time; `items` lists slots or documents.
 */
export function sendInterviewEmail(type, user, { interview, company, job, candidateName, phone, ical, link, aiNotes, hours, note, reason, items }) {
  const language = user.language ?? 'en'
  const details = interview ? detailsLine(user, interview, { phone, candidateName }) : ''
  const when = interview?.startAt ? formatWhen(user, interview.startAt, interview.minutes) : ''
  // Optional sentences are whole translated lines; an empty one is left out of the email.
  const params = {
    name: user.fullName,
    company,
    job,
    candidate: candidateName,
    details,
    when,
    link,
    items,
    intro: label(language, `intro.${user.role}`, { company, job, candidate: candidateName }),
    aiNotes: aiNotes ? label(language, 'aiNotesLine') : '',
    soon: hours ? label(language, `in${hours}h`) : '',
    released: type === 'interview_rescheduled' && when ? label(language, 'released', { when }) : '',
    wasBooked: ['interview_cancelled', 'interview_candidate_deleted'].includes(type) && when ? label(language, 'wasBooked', { when }) : '',
    reasonLine: reason ? label(language, 'reasonLine', { reason }) : '',
    noteLine: note ? label(language, 'noteLine', { note }) : '',
  }
  return sendEmail({
    type,
    to: user.email,
    userId: user._id,
    language: user.language,
    params,
    ical: ical && interview?.startAt ? calendarInvite(user, interview, ical, { company, job, details }) : undefined,
  })
}
