import { LIMITS } from '../../config/limits.js'
import { ScheduledTask } from '../../jobs/models.js'
import { scheduleTask, taskHandlers } from '../../jobs/scheduler.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { ACTIVE_FILTER, Application, PipelineStage } from '../applications/applications.model.js'
import { moveToStage, reject } from '../applications/applications.service.js'
import { Company } from '../companies/companies.model.js'
import { recordActivity } from '../discovery/discovery.service.js'
import { Job } from '../jobs/jobs.model.js'
import { addEvent, threadFor } from '../messages/messages.service.js'
import { companyRecruiter, notify } from '../notifications/notifications.service.js'
import { User } from '../users/users.model.js'
import { interviewDtos, joinWindow } from './interviews.cards.js'
import { calendarInvite, formatWhen, itemLink, sendInterviewEmail } from './interviews.emails.js'
import { Interview } from './interviews.model.js'

/*
 * Interview scheduling (§3.23, P11d-Q1 … Q29). The recruiter (Recruiter Plus, checked by the routes) offers 2–3 slots
 * for one active application; the candidate picks one or asks for other times; the recruiter reschedules (a new offer
 * on the same record) or cancels; the candidate can ask to reschedule a booked time. Each step is an event line in
 * the thread, a notification and an email for the other side. A booked interview also moves the application to the
 * Interview stage, gets 24 h / 1 h reminders and an activity entry. The outcome stays private to the company.
 */
const L = LIMITS.interviews
const ORDER = ['applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired']
const HOUR_MS = 60 * 60 * 1000

/* ---------- loading ---------- */

const ownFilter = (user) => (user.role === 'candidate' ? { candidateId: user._id } : { companyId: user.companyId })

export async function ownInterview(user, id) {
  const interview = await Interview.findOne({ _id: id, ...ownFilter(user) })
  if (!interview) throw new AppError('NOT_FOUND')
  return interview
}

const conflict = (reason) => new AppError('CONFLICT', { params: { reason } })

async function dto(user, interview) {
  return (await interviewDtos(user, [interview]))[0]
}

/** The parties and names an event needs: the candidate, the company's recruiter, the company and the job. */
async function partiesOf(interview) {
  const [candidate, recruiter, company, job] = await Promise.all([
    User.findById(interview.candidateId),
    companyRecruiter(interview.companyId),
    Company.findById(interview.companyId, 'displayName'),
    Job.findById(interview.jobId, 'title'),
  ])
  return { candidate, recruiter, company: company?.displayName ?? '', job: job?.title ?? '' }
}

const target = (interview) => ({ kind: 'interview', id: interview._id })
const conversationOf = (interview) => ({ _id: interview.conversationId })
const phoneOf = (candidate) => (candidate?.phone?.verifiedAt ? candidate.phone.e164 : null)

/* ---------- checks ---------- */

/** 2–3 slots, each at least the pick cutoff away, none overlapping another (P11d-Q3, Q10). */
function checkSlots(slots, now = new Date()) {
  const sorted = [...slots].sort((a, b) => a.startAt - b.startAt)
  sorted.forEach((slot, index) => {
    if (slot.startAt.getTime() - now.getTime() < L.pickCutoffMs) throw fieldError({ [`slots.${index}`]: 'too_soon' })
    const next = sorted[index + 1]
    if (next && slot.startAt.getTime() + slot.minutes * 60_000 > next.startAt.getTime()) throw fieldError({ [`slots.${index + 1}`]: 'overlap' })
  })
  return sorted
}

/** Where the interview happens: an address for in person (P11d-Q28), an https link for an external call (P11d-Q1). */
function placeOf({ mode, address, link, aiNotes }) {
  if (mode === 'in_person' && !address) throw fieldError({ address: 'required' })
  if (mode === 'link' && !link) throw fieldError({ link: 'required' })
  return {
    mode,
    address: mode === 'in_person' ? address : undefined,
    link: mode === 'link' ? link : undefined,
    // AI notes only on in-app video interviews (P11d-Q17).
    aiNotes: mode === 'video' && Boolean(aiNotes),
  }
}

/* ---------- scheduled tasks ---------- */

const taskKey = (type, interview, suffix = '') => `${type}:${interview._id}${suffix}`

/** The offer expires when its last slot can no longer be picked (P11d-Q10). */
export function scheduleExpiry(interview) {
  const last = Math.max(...interview.slots.map((slot) => slot.startAt.getTime()))
  return scheduleTask({ type: 'interview.expire', key: taskKey('interview.expire', interview), dueAt: new Date(last - L.pickCutoffMs), payload: { interviewId: String(interview._id), sequence: interview.sequence } })
}

/** 24 h and 1 h before (only those still ahead), and the end of the join window (an agreed recording stops then). */
export async function scheduleBooking(interview, now = new Date()) {
  for (const hours of L.reminderHours) {
    const dueAt = new Date(interview.startAt.getTime() - hours * HOUR_MS)
    if (dueAt > now) {
      await scheduleTask({ type: 'interview.reminder', key: taskKey('interview.reminder', interview, `:${hours}`), dueAt, payload: { interviewId: String(interview._id), sequence: interview.sequence, hours } })
    }
  }
  await scheduleTask({ type: 'interview.close', key: taskKey('interview.close', interview), dueAt: joinWindow(interview).closesAt, payload: { interviewId: String(interview._id), sequence: interview.sequence } })
}

/** Drops the pending tasks of these types (by default reminder, expiry and close: a change or a cancellation). */
function dropTasks(interview, types = 'expire|reminder|close') {
  return ScheduledTask.deleteMany({ status: 'pending', key: { $regex: `^interview\\.(${types}):${interview._id}` } })
}

/* ---------- recruiter ---------- */

/** POST /interviews: a new offer for one active application of the company (P11d-Q3, Q19 rule for the application). */
export async function offer(user, company, body, now = new Date()) {
  const application = await Application.findOne({ _id: body.applicationId, companyId: company._id, ...ACTIVE_FILTER })
  if (!application) throw fieldError({ applicationId: 'invalid' })
  const slots = checkSlots(body.slots, now)
  const { conversation } = await threadFor({ companyId: company._id, candidateId: application.candidateId, jobId: application.jobId, startedBy: 'recruiter' })
  if (conversation.closedAt) throw conflict('conversation_closed')
  const interview = await Interview.create({
    companyId: company._id,
    candidateId: application.candidateId,
    applicationId: application._id,
    jobId: application.jobId,
    conversationId: conversation._id,
    createdBy: user._id,
    slots,
    ...placeOf(body),
  })
  await addEvent(conversation, user, { kind: 'interview', event: 'offered', interviewId: interview._id })
  await scheduleExpiry(interview)
  await tellCandidateOffered(interview, { rescheduled: false })
  return dto(user, interview)
}

async function tellCandidateOffered(interview, { rescheduled, released }) {
  const { candidate, company, job } = await partiesOf(interview)
  if (!candidate) return
  await notify(candidate, 'interview_offered', { params: { company, job, rescheduled }, target: target(interview) })
  const items = interview.slots.map((slot) => formatWhen(candidate, slot.startAt, slot.minutes))
  const link = itemLink('candidate', 'interviews', interview._id)
  if (!rescheduled) {
    await sendInterviewEmail('interview_invitation', candidate, { interview: { mode: interview.mode, address: interview.address, link: interview.link }, company, job, items, link, aiNotes: interview.aiNotes ? 'yes' : '' })
    return
  }
  // P11d-Q15: the released booking is cancelled in the candidate's calendar.
  await sendInterviewEmail('interview_rescheduled', candidate, {
    interview: released ?? { mode: interview.mode, address: interview.address, link: interview.link },
    ical: released ? 'CANCEL' : undefined,
    company,
    job,
    items,
    link,
    aiNotes: interview.aiNotes ? 'yes' : '',
  })
}

/** POST /interviews/:id/reschedule: 2–3 new slots on the same record; a booked time is released at once (P11d-Q15). */
export async function reschedule(user, id, body, now = new Date()) {
  const interview = await ownInterview(user, id)
  if (!['offered', 'other_times', 'confirmed', 'expired'].includes(interview.status)) throw conflict(interview.status)
  if (!(await Application.exists({ _id: interview.applicationId, ...ACTIVE_FILTER }))) throw conflict('application_closed')
  const released = interview.status === 'confirmed' ? { _id: interview._id, mode: interview.mode, address: interview.address, link: interview.link, startAt: interview.startAt, minutes: interview.minutes, sequence: interview.sequence + 1 } : null
  Object.assign(interview, {
    ...placeOf(body),
    slots: checkSlots(body.slots, now),
    status: 'offered',
    startAt: undefined,
    minutes: undefined,
    confirmedAt: undefined,
    otherTimesNote: undefined,
    rescheduleRequest: undefined,
    sequence: interview.sequence + 1,
    consent: { recruiter: null, candidate: null },
  })
  await interview.save()
  await dropTasks(interview)
  await scheduleExpiry(interview)
  await addEvent(conversationOf(interview), user, { kind: 'interview', event: 'rescheduled', interviewId: interview._id })
  await tellCandidateOffered(interview, { rescheduled: true, released })
  return dto(user, interview)
}

/** POST /interviews/:id/cancel: allowed on Free too (P11d-Q27); a booked time is cancelled in the calendar. */
export async function cancel(user, id, { reason }) {
  const interview = await ownInterview(user, id)
  if (!['offered', 'other_times', 'confirmed', 'expired'].includes(interview.status)) throw conflict(interview.status)
  const wasBooked = interview.status === 'confirmed'
  interview.status = 'cancelled'
  interview.cancelledAt = new Date()
  interview.cancelReason = reason || undefined
  interview.sequence += 1
  await interview.save()
  await dropTasks(interview)
  await addEvent(conversationOf(interview), user, { kind: 'interview', event: 'cancelled', params: reason ? { reason } : {}, interviewId: interview._id })
  const { candidate, company, job } = await partiesOf(interview)
  await recordActivity({ companyId: interview.companyId, candidateId: interview.candidateId, actorId: user._id, type: 'interview_cancelled', params: { jobId: String(interview.jobId), jobTitle: job } })
  if (candidate) {
    await notify(candidate, 'interview_cancelled', { params: { company, job }, target: target(interview) })
    await sendInterviewEmail('interview_cancelled', candidate, {
      interview: wasBooked ? interview : null,
      ical: wasBooked ? 'CANCEL' : undefined,
      company,
      job,
      reason: reason ?? '',
      link: itemLink('candidate', 'interviews', interview._id),
    })
  }
  return dto(user, interview)
}

/**
 * POST /interviews/:id/outcome (P11d-Q6, Q11, Q12), from the start time on: Offer moves the application to the first
 * offer stage; Not selected runs the reject flow; Another round and Didn't attend leave it (the client then offers new
 * times or Not selected). The record and the private note are kept after retention.
 */
export async function recordOutcome(user, company, id, { result, note, notify: notifyCandidate }, now = new Date()) {
  const interview = await ownInterview(user, id)
  if (interview.status !== 'confirmed') throw conflict(interview.status)
  if (interview.startAt > now) throw conflict('not_started')
  interview.status = 'completed'
  interview.outcome = { result, note: note || undefined, at: now, by: user._id }
  await interview.save()
  // A recording still running keeps its close task.
  await dropTasks(interview, 'reminder')
  const job = await Job.findById(interview.jobId, 'title')
  await recordActivity({ companyId: interview.companyId, candidateId: interview.candidateId, actorId: user._id, type: 'interview_outcome', params: { jobId: String(interview.jobId), jobTitle: job?.title, result } })
  const application = await Application.findOne({ _id: interview.applicationId, ...ACTIVE_FILTER })
  if (application && result === 'offer') {
    const stage = await firstStage(company._id, 'offer')
    if (stage && ORDER.indexOf((await PipelineStage.findById(application.stageId, 'category'))?.category) < ORDER.indexOf('offer')) await moveToStage(user, company, application._id, stage._id)
  }
  if (application && result === 'not_selected') await reject(user, company, application._id, { notify: Boolean(notifyCandidate) })
  return dto(user, interview)
}

const firstStage = (companyId, category) => PipelineStage.findOne({ companyId, category }).sort({ order: 1 })

/* ---------- candidate ---------- */

/**
 * POST /interviews/:id/pick: one offered slot, still at least the cutoff away (P11d-Q10). Atomic, so two clicks book
 * once. Never plan-gated (P11d-Q22).
 */
export async function pick(user, id, { startAt }, now = new Date()) {
  const current = await ownInterview(user, id)
  const slot = current.slots.find((item) => item.startAt.getTime() === startAt.getTime())
  if (!slot) throw fieldError({ startAt: 'invalid' })
  if (slot.startAt.getTime() - now.getTime() < L.pickCutoffMs) throw conflict('slot_passed')
  const interview = await Interview.findOneAndUpdate(
    { _id: current._id, status: 'offered' },
    { $set: { status: 'confirmed', startAt: slot.startAt, minutes: slot.minutes, confirmedAt: now }, $unset: { otherTimesNote: 1, rescheduleRequest: 1 } },
    { returnDocument: 'after' },
  )
  if (!interview) throw conflict(current.status)
  await dropTasks(interview)
  await booked(interview, user, now)
  return dto(user, interview)
}

/** P11d-Q4, Q13: what a booking sets off for both sides. */
async function booked(interview, actor, now) {
  const { candidate, recruiter, company, job } = await partiesOf(interview)
  await addEvent(conversationOf(interview), actor, { kind: 'interview', event: 'confirmed', params: { startAt: interview.startAt, minutes: interview.minutes }, interviewId: interview._id })
  await scheduleBooking(interview, now)
  await recordActivity({ companyId: interview.companyId, candidateId: interview.candidateId, type: 'interview_confirmed', params: { jobId: String(interview.jobId), jobTitle: job, startAt: interview.startAt } })
  const params = { company, job, candidate: candidate?.fullName ?? '', startAt: interview.startAt, minutes: interview.minutes }
  for (const person of [candidate, recruiter].filter(Boolean)) {
    await notify(person, 'interview_confirmed', { params, target: target(interview) })
    await sendInterviewEmail('interview_confirmed', person, {
      interview,
      ical: 'REQUEST',
      company,
      job,
      candidateName: candidate?.fullName,
      phone: phoneOf(candidate),
      link: itemLink(person.role, 'interviews', interview._id),
    })
  }
  await advanceToInterviewStage(interview, recruiter)
}

/** P11d-Q13: the application moves to the first Interview-category stage when it sits in an earlier stage. */
async function advanceToInterviewStage(interview, recruiter) {
  const application = await Application.findOne({ _id: interview.applicationId, ...ACTIVE_FILTER })
  const current = application && (await PipelineStage.findById(application.stageId, 'category'))
  const stage = await firstStage(interview.companyId, 'interview')
  if (!application || !stage || !recruiter || ORDER.indexOf(current?.category) >= ORDER.indexOf('interview')) return
  await moveToStage(recruiter, { _id: interview.companyId }, application._id, stage._id)
}

/** POST /interviews/:id/other-times: none of the slots suits; the recruiter is told (P11d-Q3). */
export async function askOtherTimes(user, id, { note }) {
  const interview = await Interview.findOneAndUpdate({ _id: id, candidateId: user._id, status: 'offered' }, { $set: { status: 'other_times', otherTimesNote: note } }, { returnDocument: 'after' })
  if (!interview) throw await missingOr(user, id)
  await dropTasks(interview)
  await addEvent(conversationOf(interview), user, { kind: 'interview', event: 'other_times', params: { note }, interviewId: interview._id })
  await tellRecruiter(interview, 'interview_other_times', 'interview_other_times', { note })
  return dto(user, interview)
}

/** POST /interviews/:id/reschedule-request: the booking stays until the recruiter acts (P11d-Q14). */
export async function requestReschedule(user, id, { note }, now = new Date()) {
  const interview = await Interview.findOneAndUpdate(
    { _id: id, candidateId: user._id, status: 'confirmed', startAt: { $gt: now } },
    { $set: { rescheduleRequest: { note, at: now } } },
    { returnDocument: 'after' },
  )
  if (!interview) throw await missingOr(user, id)
  await addEvent(conversationOf(interview), user, { kind: 'interview', event: 'reschedule_requested', params: { note }, interviewId: interview._id })
  await tellRecruiter(interview, 'interview_reschedule_requested', 'interview_reschedule_request', { note })
  return dto(user, interview)
}

/** NOT_FOUND when the interview is not the candidate's, else CONFLICT with its status. */
async function missingOr(user, id) {
  const interview = await ownInterview(user, id)
  return conflict(interview.status)
}

async function tellRecruiter(interview, type, emailType, { note }) {
  const { candidate, recruiter, company, job } = await partiesOf(interview)
  if (!recruiter) return
  await notify(recruiter, type, { params: { candidate: candidate?.fullName ?? '', job }, target: target(interview) })
  await sendInterviewEmail(emailType, recruiter, {
    interview: interview.startAt ? interview : null,
    company,
    job,
    candidateName: candidate?.fullName,
    note,
    link: itemLink('recruiter', 'interviews', interview._id),
  })
}

/* ---------- both sides ---------- */

export async function getInterview(user, id) {
  return dto(user, await ownInterview(user, id))
}

/** GET /interviews/:id/calendar: the booked time as an .ics file ("Add to calendar"), in the reader's language. */
export async function calendarFile(user, id) {
  const interview = await ownInterview(user, id)
  if (interview.status !== 'confirmed') throw conflict(interview.status)
  const { candidate, company, job } = await partiesOf(interview)
  return calendarInvite(user, interview, 'PUBLISH', { company, job, candidateName: candidate?.fullName, phone: phoneOf(candidate) })
}

/** GET /interviews/upcoming: booked interviews whose join window has not closed, soonest first (P11d-Q16). */
export async function upcoming(user, now = new Date()) {
  const interviews = await Interview.find({ ...ownFilter(user), status: 'confirmed', startAt: { $gt: new Date(now.getTime() - 3 * HOUR_MS) } }).sort({ startAt: 1 }).limit(L.upcoming * 2)
  const open = interviews.filter((interview) => joinWindow(interview).closesAt > now).slice(0, L.upcoming)
  const items = await interviewDtos(user, open)
  const names =
    user.role === 'candidate'
      ? new Map((await Company.find({ _id: { $in: open.map((interview) => interview.companyId) } }, 'displayName')).map((company) => [String(company._id), company.displayName]))
      : new Map((await User.find({ _id: { $in: open.map((interview) => interview.candidateId) } }, 'fullName')).map((candidate) => [String(candidate._id), candidate.fullName]))
  return {
    items: items.map((item, index) => ({ ...item, counterpart: names.get(String(user.role === 'candidate' ? open[index].companyId : open[index].candidateId)) ?? null })),
    total: items.length,
    page: 1,
    pageSize: items.length,
  }
}

/* ---------- task handlers ---------- */

/** The task still applies to the interview as it is now (no change since it was scheduled). */
async function current(payload, status) {
  const interview = await Interview.findById(payload.interviewId)
  return interview && interview.status === status && interview.sequence === payload.sequence ? interview : null
}

taskHandlers['interview.expire'] = async (payload, task, now) => {
  const interview = await current(payload, 'offered')
  if (!interview || interview.slots.some((slot) => slot.startAt.getTime() - now.getTime() >= L.pickCutoffMs)) return
  interview.status = 'expired'
  await interview.save()
  const { candidate, recruiter, job } = await partiesOf(interview)
  if (recruiter) await notify(recruiter, 'interview_expired', { params: { candidate: candidate?.fullName ?? '', job }, target: target(interview) })
}

taskHandlers['interview.reminder'] = async (payload) => {
  const interview = await current(payload, 'confirmed')
  if (!interview) return
  const { candidate, recruiter, company, job } = await partiesOf(interview)
  for (const person of [candidate, recruiter].filter(Boolean)) {
    await notify(person, 'interview_reminder', { params: { company, job, candidate: candidate?.fullName ?? '', hours: payload.hours, startAt: interview.startAt }, target: target(interview) })
    await sendInterviewEmail('interview_reminder', person, {
      interview,
      company,
      job,
      candidateName: candidate?.fullName,
      phone: phoneOf(candidate),
      hours: String(payload.hours),
      link: itemLink(person.role, 'interviews', interview._id),
    })
  }
}
