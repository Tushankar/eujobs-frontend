import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import WebSocket from 'ws'
import app from '../app.js'
import { config } from '../config/env.js'
import { ScheduledTask } from '../jobs/models.js'
import { absolutePath } from '../lib/files.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { AiCache, AiUsage } from '../modules/ai/ai.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { attachSignaling, setTurnFetch } from '../modules/interviews/interviews.call.js'
import { DocumentRequest, Interview } from '../modules/interviews/interviews.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { retentionSweep } from '../modules/privacy/privacy.retention.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { aiStub } from './helpers/ai.js'
import { textPdf, webmHeader } from './helpers/fixtures.js'
import { api, attach, auth, createUser, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter } from './helpers/market.js'
import { binary, readZip } from './helpers/zip.js'

/* Phase 11d (§3.23, P11d-Q1 … Q30): interview scheduling, the call, AI notes, outcome, plans, retention and admins. */
useTestDb([
  User,
  Company,
  Job,
  CandidateProfile,
  CvVersion,
  File,
  FileAccessLog,
  VerificationSubmission,
  Subscription,
  PipelineStage,
  Application,
  Conversation,
  Message,
  ScheduledTask,
  EmailLog,
  RecruiterActivity,
  AiCache,
  AiUsage,
  Interview,
  DocumentRequest,
])
useTestUploads()
before(() => seedCatalog())

const v1 = '/api/v1'
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const code = (res) => res.body.error?.code
const at = (ms) => new Date(Date.now() + ms).toISOString()
const slots = (hours = [48, 72, 96], minutes = 45) => hours.map((h) => ({ startAt: at(h * HOUR), minutes }))
const tickAt = (date) => api().post(`${v1}/_test/scheduler/tick`).send({ now: new Date(date).toISOString() })

const post = (user, path, body = {}) => api().post(`${v1}${path}`).set(auth(user)).send(body)
const get = (user, path) => api().get(`${v1}${path}`).set(auth(user))

async function market({ plus = true, mode = 'video', aiNotes = false } = {}) {
  const { user: recruiter, company } = await approvedRecruiter({ plus, timezone: 'Europe/London' })
  const candidate = await applicantCandidate({ language: 'es', timezone: 'Europe/Madrid' })
  const job = await Job.create({
    companyId: company._id,
    createdBy: recruiter._id,
    title: 'Senior Product Designer',
    employmentType: 'full_time',
    brief: 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team.',
    requiredSkills: [{ name: 'Figma', key: 'figma' }],
    level: 'senior',
    experienceYears: 5,
    workPreference: 'hybrid',
    country: 'GB',
    location: PLACES.london,
    status: 'published',
    publishedAt: new Date(),
  })
  const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
  const application = await Application.create({
    candidateId: candidate._id,
    jobId: job._id,
    companyId: company._id,
    stageId: stage._id,
    consentAt: new Date(),
    appliedAt: new Date(),
    history: [{ status: 'applied', stageId: stage._id, stageName: stage.name, category: 'applied', at: new Date(), actorType: 'candidate' }],
  })
  const offer = (body = {}) => post(recruiter, '/interviews', { applicationId: String(application._id), mode, aiNotes, slots: slots(), ...body })
  return { recruiter, company, candidate, job, application, offer }
}

/** Moves a booked interview so its join window is open now (start in 5 minutes). */
const openWindow = (id, startIn = 5 * MINUTE) => Interview.updateOne({ _id: id }, { $set: { startAt: new Date(Date.now() + startIn) } })

describe('Offer and pick (P11d-Q3, Q4, Q13)', () => {
  it('books a slot for both sides: event lines, notifications, invites with .ics, Interview stage, reminders and activity', async () => {
    const { recruiter, candidate, application, offer } = await market()
    const offered = await offer()
    assert.equal(offered.status, 201)
    assert.equal(offered.body.status, 'offered')
    assert.equal(offered.body.slots.length, 3)
    const id = offered.body.id

    // The candidate hears at once, in Spanish, with the three slots in Madrid time.
    const [invitation] = mailTo(candidate.email, 'interview_invitation')
    assert.equal(invitation.language, 'es')
    assert.equal(invitation.params.items.length, 3)
    assert.match(invitation.params.items[0], /CET|CEST|GMT\+1|GMT\+2/)
    assert.ok(await Notification.exists({ userId: candidate._id, type: 'interview_offered', 'target.kind': 'interview', 'target.id': id }))
    const thread = (await get(candidate, `/conversations/${offered.body.conversationId}/messages`)).body
    assert.deepEqual(thread.items.map((message) => [message.kind, message.event]), [['interview', 'offered']])
    assert.equal(thread.cards.interviews[0].id, id)
    assert.equal(thread.conversation.lastMessageCard, 'interview.offered')
    assert.equal(thread.cards.interviews[0].outcome, undefined)

    const picked = await post(candidate, `/interviews/${id}/pick`, { startAt: offered.body.slots[1].startAt })
    assert.equal(picked.status, 200)
    assert.equal(picked.body.status, 'confirmed')
    assert.equal(new Date(picked.body.startAt).toISOString(), new Date(offered.body.slots[1].startAt).toISOString())
    assert.equal(code(await post(candidate, `/interviews/${id}/pick`, { startAt: offered.body.slots[0].startAt })), 'CONFLICT')

    for (const person of [candidate, recruiter]) {
      const [mail] = mailTo(person.email, 'interview_confirmed')
      assert.equal(mail.ical.method, 'REQUEST')
      // Unfolded first: RFC 5545 folds lines at 75 octets.
      assert.ok(mail.ical.content.split('\r\n').every((line) => Buffer.byteLength(line) <= 75))
      const ics = mail.ical.content.replace(/\r\n /g, '')
      assert.match(ics, new RegExp(`UID:interview-${id}@localworkman`))
      assert.match(ics, /METHOD:REQUEST/)
      assert.match(ics, /SEQUENCE:0/)
      assert.match(ics, new RegExp(`DTSTART:${new Date(offered.body.slots[1].startAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`))
      assert.match(ics, new RegExp(`ATTENDEE;[^\\r]*mailto:${person.email}`))
      assert.ok(await Notification.exists({ userId: person._id, type: 'interview_confirmed' }))
    }
    const events = (await get(recruiter, `/conversations/${offered.body.conversationId}/messages`)).body.items
    assert.deepEqual(events.map((message) => [message.senderRole, message.event]), [['recruiter', 'offered'], ['candidate', 'confirmed']])

    const moved = await Application.findById(application._id)
    assert.equal(moved.status, 'interview')
    assert.equal((await PipelineStage.findById(moved.stageId)).category, 'interview')
    assert.ok(await RecruiterActivity.exists({ type: 'interview_confirmed', candidateId: candidate._id }))
    const keys = (await ScheduledTask.find({ status: 'pending', key: new RegExp(id) })).map((task) => task.key).sort()
    assert.deepEqual(keys, [`interview.close:${id}`, `interview.reminder:${id}:1`, `interview.reminder:${id}:24`])

    // The candidate's applications list the interview (the application's activity, P11d-Q16).
    const list = (await get(candidate, '/candidate/applications')).body.items
    assert.equal(list[0].interviews[0].status, 'confirmed')

    // 24 hours before: both get the reminder; the candidate switched the Interviews emails off (P11d-Q4).
    await api().patch(`${v1}/me/notifications`).set(auth(candidate)).send({ emailSwitches: { interviews: false } }).expect(200)
    await tickAt(new Date(picked.body.startAt).getTime() - 24 * HOUR + MINUTE)
    assert.equal(mailTo(recruiter.email, 'interview_reminder').length, 1)
    assert.equal(mailTo(candidate.email, 'interview_reminder').length, 0)
    assert.ok(await EmailLog.exists({ type: 'interview_reminder', userId: candidate._id, status: 'skipped_toggle' }))
    assert.equal(await Notification.countDocuments({ type: 'interview_reminder' }), 2)
  })

  it('validates the offer: 2–3 slots at least 1 hour away, no overlap, the place, the application', async () => {
    const { recruiter, company, offer, application } = await market()
    const fieldsOf = async (body) => (await offer(body)).body.error?.fields
    assert.ok((await fieldsOf({ slots: slots([48]) })).slots)
    assert.ok((await fieldsOf({ slots: slots([48, 72, 96, 120]) })).slots)
    assert.deepEqual(await fieldsOf({ slots: [{ startAt: at(30 * MINUTE), minutes: 30 }, { startAt: at(48 * HOUR), minutes: 30 }] }), { 'slots.0': 'too_soon' })
    assert.deepEqual(await fieldsOf({ slots: [{ startAt: at(48 * HOUR), minutes: 60 }, { startAt: at(48 * HOUR + 30 * MINUTE), minutes: 30 }] }), { 'slots.1': 'overlap' })
    assert.ok((await fieldsOf({ slots: [{ startAt: at(48 * HOUR), minutes: 20 }, { startAt: at(72 * HOUR), minutes: 30 }] }))['slots.0.minutes'])
    assert.deepEqual(await fieldsOf({ mode: 'in_person' }), { address: 'required' })
    assert.ok((await fieldsOf({ mode: 'link', link: 'http://meet.example.com/x' })).link)
    const phone = await offer({ mode: 'phone', aiNotes: true })
    assert.equal(phone.body.aiNotes, false)
    // Another company's application, or one that is no longer active.
    const other = await approvedRecruiter()
    assert.deepEqual((await post(other.user, '/interviews', { applicationId: String(application._id), slots: slots() })).body.error.fields, { applicationId: 'invalid' })
    await Application.updateOne({ _id: application._id }, { status: 'withdrawn', withdrawnAt: new Date() })
    assert.deepEqual(await fieldsOf({}), { applicationId: 'invalid' })
    assert.ok(company && recruiter)
  })
})

describe('Changes (P11d-Q3, Q14, Q15)', () => {
  it('other times, reschedule, ask to reschedule and cancel each tell the other side, with calendar cancels', async () => {
    const { recruiter, candidate, offer } = await market()
    const { body: first } = await offer()
    const id = first.id

    const other = await post(candidate, `/interviews/${id}/other-times`, { note: 'Could we meet on Friday?' })
    assert.equal(other.body.status, 'other_times')
    assert.equal(mailTo(recruiter.email, 'interview_other_times')[0].params.noteLine, 'Note: “Could we meet on Friday?”')
    assert.ok(await Notification.exists({ userId: recruiter._id, type: 'interview_other_times' }))
    assert.equal(code(await post(candidate, `/interviews/${id}/pick`, { startAt: first.slots[0].startAt })), 'CONFLICT')

    const renewed = await post(recruiter, `/interviews/${id}/reschedule`, { mode: 'video', slots: slots([50, 74]) })
    assert.equal(renewed.body.status, 'offered')
    const [moved] = mailTo(candidate.email, 'interview_rescheduled')
    assert.equal(moved.ical, null, 'nothing was booked yet, so there is no calendar cancel')
    await post(candidate, `/interviews/${id}/pick`, { startAt: renewed.body.slots[0].startAt }).expect(200)

    const asked = await post(candidate, `/interviews/${id}/reschedule-request`, { note: 'I have a clash.' })
    assert.equal(asked.body.status, 'confirmed')
    assert.equal(asked.body.rescheduleRequest.note, 'I have a clash.')
    assert.ok(mailTo(recruiter.email, 'interview_reschedule_request')[0].params.when)

    const again = await post(recruiter, `/interviews/${id}/reschedule`, { mode: 'video', slots: slots([52, 76]) })
    assert.equal(again.body.rescheduleRequest, null)
    const released = mailTo(candidate.email, 'interview_rescheduled').at(-1)
    assert.equal(released.ical.method, 'CANCEL')
    assert.match(released.ical.content, /STATUS:CANCELLED/)
    assert.match(released.ical.content, /SEQUENCE:2/)
    assert.equal(await ScheduledTask.countDocuments({ status: 'pending', key: new RegExp(`interview\\.(reminder|close):${id}`) }), 0)

    await post(candidate, `/interviews/${id}/pick`, { startAt: again.body.slots[1].startAt }).expect(200)
    const cancelled = await post(recruiter, `/interviews/${id}/cancel`, { reason: 'The role was filled.' })
    assert.equal(cancelled.body.status, 'cancelled')
    const [mail] = mailTo(candidate.email, 'interview_cancelled')
    assert.equal(mail.ical.method, 'CANCEL')
    assert.match(mail.params.reasonLine, /The role was filled/)
    assert.ok(await Notification.exists({ userId: candidate._id, type: 'interview_cancelled' }))
    assert.equal(await ScheduledTask.countDocuments({ status: 'pending', key: new RegExp(id) }), 0)
    const events = (await get(candidate, `/conversations/${first.conversationId}/messages`)).body.items.map((message) => message.event)
    assert.deepEqual(events, ['offered', 'other_times', 'rescheduled', 'confirmed', 'reschedule_requested', 'rescheduled', 'confirmed', 'cancelled'])
  })

  it('expires an offer when no slot can be picked any more, and refuses a slot less than 1 hour away (P11d-Q10)', async () => {
    const { recruiter, candidate, offer } = await market()
    const { body } = await offer({ slots: slots([2, 3]) })
    await Interview.updateOne({ _id: body.id }, { $set: { 'slots.0.startAt': new Date(Date.now() + 30 * MINUTE) } })
    assert.equal((await post(candidate, `/interviews/${body.id}/pick`, { startAt: new Date(Date.now() + 30 * MINUTE).toISOString() })).status, 422)
    const first = (await Interview.findById(body.id)).slots[0].startAt
    assert.equal((await post(candidate, `/interviews/${body.id}/pick`, { startAt: first.toISOString() })).body.error.params.reason, 'slot_passed')
    await tickAt(Date.now() + 2 * HOUR + MINUTE)
    assert.equal((await Interview.findById(body.id)).status, 'expired')
    assert.ok(await Notification.exists({ userId: recruiter._id, type: 'interview_expired' }))
  })
})

describe('Outcome (P11d-Q6, Q11, Q12)', () => {
  it('waits for the start; Offer moves the application, Not selected rejects it; the note stays with the company', async () => {
    const { recruiter, candidate, offer, application } = await market()
    const book = async () => {
      const { body } = await offer()
      await post(candidate, `/interviews/${body.id}/pick`, { startAt: body.slots[0].startAt }).expect(200)
      return body.id
    }
    const first = await book()
    assert.equal((await post(recruiter, `/interviews/${first}/outcome`, { result: 'offer' })).body.error.params.reason, 'not_started')
    await Interview.updateOne({ _id: first }, { $set: { startAt: new Date(Date.now() - HOUR) } })
    const done = await post(recruiter, `/interviews/${first}/outcome`, { result: 'offer', note: 'Strong portfolio.' })
    assert.equal(done.body.status, 'completed')
    assert.deepEqual([done.body.outcome.result, done.body.outcome.note], ['offer', 'Strong portfolio.'])
    const offered = await Application.findById(application._id)
    assert.equal(offered.status, 'offer')
    assert.equal((await PipelineStage.findById(offered.stageId)).category, 'offer')
    const seen = (await get(candidate, `/interviews/${first}`)).body
    assert.equal(seen.outcome, undefined)
    assert.equal(JSON.stringify(seen).includes('Strong portfolio'), false)
    assert.ok(await RecruiterActivity.exists({ type: 'interview_outcome', 'params.result': 'offer' }))

    const second = await book()
    await Interview.updateOne({ _id: second }, { $set: { startAt: new Date(Date.now() - HOUR) } })
    await post(recruiter, `/interviews/${second}/outcome`, { result: 'not_selected', notify: true }).expect(200)
    const rejected = await Application.findById(application._id)
    assert.equal(rejected.status, 'not_selected')
    assert.equal(rejected.rejectNotify, true)
  })
})

describe('Plans (P11d-Q8, Q22, Q27)', () => {
  it('Recruiter Plus to offer, reschedule and request documents; after the plan ends the rest still works; candidates never gated', async () => {
    const free = await market({ plus: false })
    const locked = await free.offer()
    assert.equal(locked.status, 402)
    assert.equal(locked.body.error.params.entitlement, 'interviews')
    const request = await attach(api().post(`${v1}/document-requests`).set(auth(free.recruiter)), Buffer.from(''), 'x.txt', 'text/plain', { applicationId: String(free.application._id), items: JSON.stringify([{ kind: 'id' }]) })
    assert.equal(request.status, 402)

    const plus = await market()
    const { body: one } = await plus.offer()
    const { body: two } = await plus.offer()
    // Both plans end: the candidate's Plus and the recruiter's Recruiter Plus.
    await Subscription.deleteMany({ userId: { $in: [plus.recruiter._id, plus.candidate._id] } })
    await post(plus.candidate, `/interviews/${one.id}/pick`, { startAt: one.slots[0].startAt }).expect(200)
    assert.equal((await post(plus.recruiter, `/interviews/${one.id}/reschedule`, { slots: slots() })).status, 402)
    assert.equal((await post(plus.recruiter, `/interviews/${two.id}/cancel`)).status, 200)
    await Interview.updateOne({ _id: one.id }, { $set: { startAt: new Date(Date.now() - HOUR) } })
    assert.equal((await post(plus.recruiter, `/interviews/${one.id}/outcome`, { result: 'another_round' })).status, 200)
  })
})

describe('The call (P11d-Q2, Q5, Q17, Q18, Q23, Q26, Q29)', () => {
  let server
  let base
  const open = []
  before(async () => {
    server = createServer(app)
    attachSignaling(server)
    await new Promise((resolve) => server.listen(0, resolve))
    base = `ws://127.0.0.1:${server.address().port}${v1}/interviews/signal`
  })
  after(() => {
    for (const socket of open) socket.terminate()
    server.closeAllConnections()
    return new Promise((resolve) => server.close(resolve))
  })

  /** A socket that keeps every message it receives. */
  function connect(ticket) {
    const socket = new WebSocket(`${base}?ticket=${ticket}`)
    open.push(socket)
    socket.received = []
    socket.on('message', (raw) => socket.received.push(JSON.parse(raw)))
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(socket))
      socket.once('unexpected-response', (req, res) => reject(new Error(String(res.statusCode))))
    })
  }
  /** The socket knows the other side is there: it was there first (ready with a peer) or joined later. */
  const paired = (socket) => socket.received.some((message) => (message.type === 'ready' && message.peer) || message.type === 'peer-joined')
  const until = async (check) => {
    for (let i = 0; i < 100 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 20))
    assert.ok(check())
  }

  async function booked(options) {
    const parties = await market(options)
    const { body } = await parties.offer()
    await post(parties.candidate, `/interviews/${body.id}/pick`, { startAt: body.slots[0].startAt }).expect(200)
    return { ...parties, id: body.id }
  }

  it('opens 10 minutes before the start; ICE servers, ticket and the phone fallback; relays signals between the two parties', async () => {
    const { recruiter, candidate, id } = await booked()
    const early = await post(candidate, `/interviews/${id}/join`)
    assert.equal(early.body.error.params.reason, 'too_early')
    await openWindow(id)
    const joined = await post(recruiter, `/interviews/${id}/join`)
    assert.equal(joined.status, 200)
    assert.deepEqual(joined.body.iceServers, [{ urls: ['stun:stun.l.google.com:19302'] }])
    assert.equal(joined.body.fallbackPhone, '+442079460000')
    const candidateJoin = (await post(candidate, `/interviews/${id}/join`)).body

    const first = await connect(joined.body.ticket)
    await until(() => first.received.some((message) => message.type === 'ready'))
    assert.equal(first.received[0].peer, false)
    const second = await connect(candidateJoin.ticket)
    await until(() => second.received.some((message) => message.type === 'ready' && message.peer))
    await until(() => first.received.some((message) => message.type === 'peer-joined'))
    first.send(JSON.stringify({ type: 'signal', data: { sdp: 'offer-sdp' } }))
    await until(() => second.received.some((message) => message.type === 'signal' && message.data.sdp === 'offer-sdp'))
    second.close()
    await until(() => first.received.some((message) => message.type === 'peer-left'))
    first.close()

    await assert.rejects(connect('not-a-ticket'), /401/)
    // The window closes 30 minutes after the scheduled end.
    await Interview.updateOne({ _id: id }, { $set: { startAt: new Date(Date.now() - 45 * MINUTE - 31 * MINUTE) } })
    assert.equal((await post(candidate, `/interviews/${id}/join`)).body.error.params.reason, 'closed')
    const phone = await booked({ mode: 'phone' })
    assert.equal((await get(phone.recruiter, `/interviews/${phone.id}`)).body.phone, '+442079460000')
    assert.equal((await post(phone.candidate, `/interviews/${phone.id}/join`)).body.error.params.reason, 'not_video')
  })

  it('asks Cloudflare for short-lived TURN credentials and drops port 53 (P11d-Q29)', async () => {
    const { recruiter, id } = await booked()
    await openWindow(id)
    const requests = []
    config.turn = { keyId: 'test-key-id', apiToken: 'test-token' }
    setTurnFetch(async (url, init) => {
      requests.push({ url, init })
      const urls = ['turn:turn.example.net:3478?transport=udp', 'turn:turn.example.net:53?transport=udp', 'turns:turn.example.net:443?transport=tcp']
      return new Response(JSON.stringify({ iceServers: [{ urls: ['stun:stun.example.net:3478'] }, { urls, username: 'u', credential: 'c' }] }), { status: 201 })
    })
    try {
      const { body } = await post(recruiter, `/interviews/${id}/join`)
      assert.equal(requests[0].url, 'https://rtc.live.cloudflare.com/v1/turn/keys/test-key-id/credentials/generate-ice-servers')
      assert.equal(requests[0].init.headers.Authorization, 'Bearer test-token')
      assert.ok(JSON.parse(requests[0].init.body).ttl > 45 * 60)
      assert.equal(body.iceServers.length, 3)
      assert.deepEqual(body.iceServers[2].urls, ['turn:turn.example.net:3478?transport=udp', 'turns:turn.example.net:443?transport=tcp'])
    } finally {
      config.turn = null
      setTurnFetch()
    }
  })

  it('records only when both agree and both are in the call; either can stop; notes in the recruiter\'s language; the audio is deleted (P11d-Q5, Q18)', async () => {
    const declined = await booked({ aiNotes: true })
    await openWindow(declined.id)
    const noNotes = await booked()
    await openWindow(noNotes.id)
    assert.equal((await post(noNotes.candidate, `/interviews/${noNotes.id}/consent`, { agree: true })).body.error.params.reason, 'no_ai_notes')
    await post(declined.recruiter, `/interviews/${declined.id}/consent`, { agree: true }).expect(200)
    await post(declined.candidate, `/interviews/${declined.id}/consent`, { agree: false }).expect(200)
    assert.equal((await post(declined.candidate, `/interviews/${declined.id}/consent`, { agree: true })).body.error.params.reason, 'answered')
    assert.equal((await post(declined.recruiter, `/interviews/${declined.id}/recording/start`)).body.error.params.reason, 'no_consent')
    const refused = await api().post(`${v1}/interviews/${declined.id}/recording/chunks?seq=0`).set(auth(declined.recruiter)).set('Content-Type', 'application/octet-stream').send(webmHeader())
    assert.equal(refused.body.error.params.reason, 'not_recording')

    const { recruiter, candidate, id } = await booked({ aiNotes: true })
    await User.updateOne({ _id: recruiter._id }, { language: 'fr' })
    await openWindow(id)
    const tickets = await Promise.all([post(recruiter, `/interviews/${id}/join`), post(candidate, `/interviews/${id}/join`)])
    await post(recruiter, `/interviews/${id}/consent`, { agree: true }).expect(200)
    await post(candidate, `/interviews/${id}/consent`, { agree: true }).expect(200)
    assert.equal((await post(recruiter, `/interviews/${id}/recording/start`)).body.error.params.reason, 'not_connected')
    const sockets = await Promise.all(tickets.map((res) => connect(res.body.ticket)))
    await until(() => paired(sockets[0]) && paired(sockets[1]))
    assert.equal((await post(candidate, `/interviews/${id}/recording/start`)).status, 403)
    const started = await post(recruiter, `/interviews/${id}/recording/start`)
    assert.equal(started.body.recording.status, 'recording')
    await until(() => sockets[1].received.some((message) => message.type === 'state' && message.recording === 'recording'))
    const chunk = (seq, buffer) => api().post(`${v1}/interviews/${id}/recording/chunks?seq=${seq}`).set(auth(recruiter)).set('Content-Type', 'application/octet-stream').send(buffer)
    assert.equal((await chunk(0, webmHeader())).body.stored, true)
    assert.equal((await chunk(0, webmHeader())).body.stored, false, 'a repeated chunk is ignored')
    assert.equal((await chunk(2, Buffer.alloc(100, 1))).body.error.params.reason, 'out_of_order')
    await chunk(1, Buffer.alloc(100, 1)).expect(200)
    const audio = await File.findById((await Interview.findById(id)).recording.fileId)
    assert.equal(audio.purpose, 'interview_audio')
    assert.equal(audio.size, webmHeader().length + 100)

    // The candidate stops it; the recruiter's last chunk still arrives; the notes follow.
    const stopped = await post(candidate, `/interviews/${id}/recording/stop`)
    assert.equal(stopped.body.recording.status, 'processing')
    await until(() => sockets[0].received.some((message) => message.type === 'state' && message.recording === 'processing'))
    await chunk(2, Buffer.alloc(50, 2)).expect(200)
    sockets.forEach((socket) => socket.close())
    aiStub.reset()
    aiStub.reply = (request) => (request.text.format.name === 'interview_notes' ? { summary: 'Résumé', keyAnswers: ['A'], strengths: ['B'], concerns: ['C'], followUps: ['D'] } : null)
    await tickAt(Date.now() + 20_000)
    aiStub.reply = null
    assert.ok(aiStub.calls.some((call) => call.kind === 'transcription'))
    const notesCall = aiStub.calls.find((call) => call.text?.format?.name === 'interview_notes')
    assert.match(notesCall.instructions, /French/)
    assert.match(notesCall.input, /stub transcript/)
    const done = await Interview.findById(id)
    assert.equal(done.recording.status, 'ready')
    assert.equal(done.recording.fileId, null)
    assert.equal(await File.exists({ _id: audio._id }), null)
    await assert.rejects(access(absolutePath(audio)))
    assert.ok(await Notification.exists({ userId: recruiter._id, type: 'interview_notes_ready' }))
    const notes = await get(recruiter, `/interviews/${id}/notes`)
    assert.deepEqual([notes.body.summary, notes.body.followUps, notes.body.language], ['Résumé', ['D'], 'fr'])
    assert.match(notes.body.transcript, /stub transcript/)
    assert.equal((await get(candidate, `/interviews/${id}/notes`)).status, 403)
    assert.equal((await get(recruiter, `/interviews/${id}`)).body.hasNotes, true)
    assert.equal((await get(candidate, `/interviews/${id}`)).body.hasNotes, undefined)

    // Starting AI notes needs Recruiter Plus when the plan has ended (P11d-Q27).
    const lapsed = await booked({ aiNotes: true })
    await openWindow(lapsed.id)
    const lapsedTickets = await Promise.all([post(lapsed.recruiter, `/interviews/${lapsed.id}/join`), post(lapsed.candidate, `/interviews/${lapsed.id}/join`)])
    await post(lapsed.recruiter, `/interviews/${lapsed.id}/consent`, { agree: true }).expect(200)
    await post(lapsed.candidate, `/interviews/${lapsed.id}/consent`, { agree: true }).expect(200)
    const lapsedSockets = await Promise.all(lapsedTickets.map((res) => connect(res.body.ticket)))
    await until(() => paired(lapsedSockets[0]) && paired(lapsedSockets[1]))
    await Subscription.deleteMany({ userId: lapsed.recruiter._id })
    assert.equal((await post(lapsed.recruiter, `/interviews/${lapsed.id}/recording/start`)).status, 402)
    lapsedSockets.forEach((socket) => socket.close())
  })
})

describe('Admins, export and retention (P11d-Q5, Q8, Q24)', () => {
  it('admins never open interviews or requests; Recruitment counts scheduled and completed', async () => {
    const { recruiter, candidate, offer } = await market()
    const { body } = await offer()
    await post(candidate, `/interviews/${body.id}/pick`, { startAt: body.slots[0].startAt }).expect(200)
    await Interview.updateOne({ _id: body.id }, { $set: { startAt: new Date(Date.now() - HOUR) } })
    await post(recruiter, `/interviews/${body.id}/outcome`, { result: 'another_round' }).expect(200)
    await offer().expect(201)
    const admin = await createUser({ role: 'admin', isOwner: true })
    for (const path of [`/interviews/${body.id}`, `/interviews/${body.id}/notes`, '/interviews/upcoming']) assert.equal((await get(admin, path)).status, 403)
    const { stats } = (await get(admin, '/admin/recruitment')).body
    assert.deepEqual([stats.interviewsScheduled, stats.interviewsCompleted], [1, 1])
    // Another company sees nothing.
    const other = await approvedRecruiter()
    assert.equal((await get(other.user, `/interviews/${body.id}`)).status, 404)
  })

  it('exports the candidate\'s interviews with notes; erasure deletes them; notes and documents go 6 months after the close', async () => {
    const { recruiter, candidate, offer, application } = await market()
    const { body } = await offer()
    await post(candidate, `/interviews/${body.id}/pick`, { startAt: body.slots[0].startAt }).expect(200)
    await Interview.updateOne({ _id: body.id }, { $set: { transcript: 'Hello there', notes: { summary: 'Calm and clear', keyAnswers: [], strengths: [], concerns: [], followUps: [], generatedAt: new Date() }, outcome: { result: 'another_round', note: 'Private note', at: new Date() } } })
    const zip = readZip((await api().get(`${v1}/me/export`).set(auth(candidate)).buffer(true).parse(binary)).body)
    const [exported] = JSON.parse(zip['interviews.json'])
    assert.deepEqual([exported.notes.summary, exported.transcript], ['Calm and clear', 'Hello there'])
    assert.equal(JSON.stringify(exported).includes('Private note'), false)
    // P11d-A2: the recruiter's export holds the company's interviews with its outcome, feedback, AI notes and transcript.
    const companyZip = readZip((await api().get(`${v1}/me/export`).set(auth(recruiter)).buffer(true).parse(binary)).body)
    const [held] = JSON.parse(companyZip['interviews.json'])
    assert.deepEqual([held.candidate, held.outcome.result, held.outcome.note, held.notes.summary, held.transcript], [candidate.fullName, 'another_round', 'Private note', 'Calm and clear', 'Hello there'])
    assert.equal(held.status, 'confirmed')

    // Retention: the application closed 7 months ago.
    const pdf = await textPdf(['Passport scan'])
    const created = await attach(api().post(`${v1}/document-requests`).set(auth(recruiter)), pdf, 'offer.pdf', 'application/pdf', { applicationId: String(application._id), items: JSON.stringify([{ kind: 'id' }]) })
    const item = created.body.items[0].id
    await attach(api().post(`${v1}/document-requests/${created.body.id}/items/${item}`).set(auth(candidate)), pdf, 'id.pdf', 'application/pdf').expect(200)
    const files = (await DocumentRequest.findById(created.body.id)).items.map((entry) => entry.fileId).concat(created.body.attachment ? [(await DocumentRequest.findById(created.body.id)).attachmentFileId] : [])
    await Application.updateOne({ _id: application._id }, { status: 'withdrawn', withdrawnAt: new Date(Date.now() - 200 * 24 * HOUR) })
    const result = await retentionSweep(new Date())
    assert.deepEqual([result.interviews, result.documentRequests], [1, 1])
    const purged = await Interview.findById(body.id)
    assert.equal(purged.transcript, undefined)
    assert.equal(purged.notes?.summary, undefined)
    assert.equal(purged.outcome.note, 'Private note')
    assert.equal(await File.countDocuments({ _id: { $in: files } }), 0)
    const card = (await get(recruiter, `/document-requests/${created.body.id}`)).body
    assert.equal(card.removed, true)
    assert.equal(card.items[0].file, null)

    // Erasure deletes the candidate's interviews and requests.
    await api().delete(`${v1}/me`).set(auth(candidate)).send({ currentPassword: 'Harbour-Lantern-58' }).expect(204)
    assert.equal(await Interview.countDocuments({ candidateId: candidate._id }), 0)
    assert.equal(await DocumentRequest.countDocuments({ candidateId: candidate._id }), 0)
  })
})
