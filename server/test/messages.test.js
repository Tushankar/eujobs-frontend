import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ScheduledTask } from '../jobs/models.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter, listedCandidate } from './helpers/market.js'

useTestDb([User, Company, Job, CandidateProfile, CvVersion, File, VerificationSubmission, Subscription, PipelineStage, Application, Conversation, Message, ScheduledTask, EmailLog, RecruiterActivity])
before(() => seedCatalog())

const MINUTE = 60 * 1000
const v1 = '/api/v1'

const publish = (company, recruiter) =>
  Job.create({
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
    firstPublishedAt: new Date(),
  })

const start = (user, body) => api().post(`${v1}/conversations`).set(auth(user)).send(body)
const send = (user, id, body) => api().post(`${v1}/conversations/${id}/messages`).set(auth(user)).send({ body })
const thread = (user, id) => api().get(`${v1}/conversations/${id}/messages`).set(auth(user))
const read = (user, id) => api().post(`${v1}/conversations/${id}/read`).set(auth(user))
const inbox = async (user) => (await api().get(`${v1}/conversations`).set(auth(user))).body
const counters = async (user) => (await api().get(`${v1}/me/counters`).set(auth(user))).body
const tickAt = (ms) => api().post(`${v1}/_test/scheduler/tick`).send({ now: new Date(Date.now() + ms).toISOString() })
const code = (res) => res.body.error?.code

/** An application record of `candidate` to `job` (the apply flow is Phase 6's subject). */
async function applyRecord(candidate, job, status = 'applied') {
  const stage = await PipelineStage.findOne({ companyId: job.companyId, isEntry: true })
  const now = new Date()
  return Application.create({ candidateId: candidate._id, jobId: job._id, companyId: job.companyId, stageId: stage._id, status, consentAt: now, appliedAt: now, history: [{ status: 'applied', at: now, actorType: 'candidate' }] })
}

describe('starting conversations (M-084, M-085, U28)', () => {
  it('lets a recruiter start with a discoverable candidate, records outreach and counts the unread message', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const job = await publish(company, recruiter)
    const candidate = await listedCandidate()
    const res = await start(recruiter, { candidateId: String(candidate._id), jobId: String(job._id), body: 'Hi, your profile stood out.' })
    assert.equal(res.status, 201)
    assert.deepEqual([res.body.conversation.job.title, res.body.conversation.counterpart.name, res.body.message.mine], [job.title, candidate.fullName, true])
    assert.equal(await RecruiterActivity.countDocuments({ companyId: company._id, candidateId: candidate._id, type: 'outreach' }), 1)
    assert.deepEqual(await counters(candidate), { unreadMessages: 1, activeApplications: 0 })
    assert.deepEqual(await counters(recruiter), { unreadMessages: 0 })

    // A second "start" adds to the same thread (one per company and candidate) and is not a new outreach.
    const again = await start(recruiter, { candidateId: String(candidate._id), body: 'Following up.' })
    assert.equal(again.body.conversation.id, res.body.conversation.id)
    assert.equal(await Conversation.countDocuments(), 1)
    assert.equal(await RecruiterActivity.countDocuments({ type: 'outreach' }), 1)
    assert.equal((await counters(candidate)).unreadMessages, 2)
  })

  it('refuses a recruiter a non-discoverable non-applicant, allows a hidden applicant, keeps threads open after hiding', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const job = await publish(company, recruiter)
    const hidden = await listedCandidate({ privacy: { discoverable: false, resumeVisible: false, matchingConsent: true } })
    const refused = await start(recruiter, { candidateId: String(hidden._id), body: 'Hello' })
    assert.deepEqual([refused.status, code(refused)], [403, 'FORBIDDEN'])

    await applyRecord(hidden, job)
    assert.equal((await start(recruiter, { candidateId: String(hidden._id), body: 'Thanks for applying.' })).status, 201)

    // U28: the candidate hides after a thread exists; the thread works both ways, a new company cannot start.
    const plus = await applicantCandidate()
    const opened = await start(recruiter, { candidateId: String(plus._id), body: 'Hi there' })
    await User.updateOne({ _id: plus._id }, { 'privacy.discoverable': false })
    assert.equal((await send(recruiter, opened.body.conversation.id, 'Still keen?')).status, 201)
    assert.equal((await start(recruiter, { candidateId: String(plus._id), body: 'And again' })).status, 201)
    assert.equal((await send(plus, opened.body.conversation.id, 'Yes, happy to talk.')).status, 201)
    const { user: other } = await approvedRecruiter()
    assert.equal((await start(other, { candidateId: String(plus._id), body: 'Hello' })).status, 403)
  })

  it('needs an approved recruiter and a job of the own company', async () => {
    const { user: pending } = await approvedRecruiter({ status: 'pending_review' })
    const candidate = await listedCandidate()
    assert.equal((await start(pending, { candidateId: String(candidate._id), body: 'Hi' })).status, 403)
    const { user: recruiter } = await approvedRecruiter()
    const { user: otherRecruiter, company: otherCompany } = await approvedRecruiter()
    const foreign = await publish(otherCompany, otherRecruiter)
    const res = await start(recruiter, { candidateId: String(candidate._id), jobId: String(foreign._id), body: 'Hi' })
    assert.deepEqual([res.status, res.body.error.fields.jobId], [422, 'invalid'])
  })

  it('lets a paid candidate start only with a company they applied to; Free candidates read only', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const job = await publish(company, recruiter)
    const { user: otherRecruiter, company: otherCompany } = await approvedRecruiter()
    const otherJob = await publish(otherCompany, otherRecruiter)
    const plus = await applicantCandidate()
    await applyRecord(plus, job, 'withdrawn')

    const res = await start(plus, { jobId: String(job._id), body: 'A question about the role.' })
    assert.equal(res.status, 201)
    assert.equal(res.body.conversation.counterpart.name, company.displayName)
    assert.equal((await counters(recruiter)).unreadMessages, 1)
    assert.equal(await RecruiterActivity.countDocuments({ type: 'outreach' }), 0)
    const refused = await start(plus, { jobId: String(otherJob._id), body: 'Hello' })
    assert.deepEqual([refused.status, code(refused)], [403, 'FORBIDDEN'])
    assert.deepEqual((await start(plus, { body: 'Hello' })).body.error.fields, { jobId: 'required' })

    // M-118: a Free candidate reads but neither starts nor replies.
    const free = await applicantCandidate({ plus: false })
    await applyRecord(free, job)
    const startFree = await start(free, { jobId: String(job._id), body: 'Hello' })
    assert.deepEqual([startFree.status, code(startFree), startFree.body.error.params.entitlement], [402, 'PLAN_REQUIRED', 'message_send'])
    const opened = await start(recruiter, { candidateId: String(free._id), body: 'We liked your application.' })
    const view = await thread(free, opened.body.conversation.id)
    assert.equal(view.status, 200)
    assert.equal(view.body.items[0].body, 'We liked your application.')
    assert.equal((await send(free, opened.body.conversation.id, 'Thanks')).status, 402)
  })
})

describe('messages, reading and access (M-086, M-087, M-094)', () => {
  it('limits a message to 2,000 characters of text', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await listedCandidate()
    const long = await start(recruiter, { candidateId: String(candidate._id), body: 'x'.repeat(2001) })
    assert.deepEqual([long.status, long.body.error.fields.body, long.body.error.params.max], [422, 'too_long', 2000])
    assert.equal((await start(recruiter, { candidateId: String(candidate._id), body: '   ' })).body.error.fields.body, 'required')
    assert.equal((await start(recruiter, { candidateId: String(candidate._id), body: 'x'.repeat(2000) })).status, 201)
  })

  it('marks the other side read, clears the badge, records the reply and hides the plan from recruiters', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const candidate = await applicantCandidate()
    const { body } = await start(recruiter, { candidateId: String(candidate._id), body: 'Hi' })
    const id = body.conversation.id
    assert.equal((await inbox(candidate)).items[0].unread, 1)
    assert.equal((await read(candidate, id)).status, 204)
    assert.equal((await counters(candidate)).unreadMessages, 0)
    assert.ok((await Message.findOne({ conversationId: id })).readAt)

    await send(candidate, id, 'Hello back')
    await send(candidate, id, 'And one more thing')
    assert.equal((await counters(recruiter)).unreadMessages, 2)
    // M-081: one "replied" event per answer to the recruiter, not per message.
    assert.equal(await RecruiterActivity.countDocuments({ companyId: company._id, type: 'message_reply' }), 1)
    const recruiterView = await thread(recruiter, id)
    assert.deepEqual(recruiterView.body.items.map((message) => [message.senderRole, message.mine]), [['recruiter', true], ['candidate', false], ['candidate', false]])
    // M-087: nothing about the candidate's plan reaches the recruiter.
    assert.doesNotMatch(JSON.stringify([recruiterView.body, await inbox(recruiter)]), /plan|plus|entitle/i)
    await read(recruiter, id)
    assert.equal((await counters(recruiter)).unreadMessages, 0)
    assert.equal((await inbox(recruiter)).items[0].lastMessagePreview, 'And one more thing')
  })

  it('keeps each thread to its own candidate and company', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await listedCandidate()
    const { body } = await start(recruiter, { candidateId: String(candidate._id), body: 'Hi' })
    const { user: otherRecruiter } = await approvedRecruiter()
    const stranger = await createUser({ role: 'candidate' })
    assert.equal((await thread(otherRecruiter, body.conversation.id)).status, 404)
    assert.equal((await thread(stranger, body.conversation.id)).status, 404)
    assert.equal((await read(stranger, body.conversation.id)).status, 404)
    assert.deepEqual((await inbox(otherRecruiter)).items, [])
  })
})

describe('the new-message email (M-089, U13)', () => {
  it('waits 15 minutes unread, then at most one email per thread and side per 60 minutes, in the recipient’s language', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await listedCandidate({ language: 'es' })
    const { body } = await start(recruiter, { candidateId: String(candidate._id), body: 'Hola' })
    await tickAt(14 * MINUTE)
    assert.equal(mailTo(candidate.email, 'new_message').length, 0)
    await tickAt(15 * MINUTE + 5000)
    const [mail] = mailTo(candidate.email, 'new_message')
    assert.equal(mail.language, 'es')
    assert.match(mail.subject, /Nuevo mensaje de .*Studio/)
    assert.match(mail.params.link, new RegExp(`/candidate/messages/${body.conversation.id}$`))

    // A second unread message soon after: no email within the hour of the first one.
    await send(recruiter, body.conversation.id, 'Una cosa más')
    await tickAt(35 * MINUTE)
    assert.equal(mailTo(candidate.email, 'new_message').length, 1)
    await tickAt(76 * MINUTE)
    assert.equal(mailTo(candidate.email, 'new_message').length, 2)
  })

  it('sends nothing when the message is read in time, and emails the recruiter about replies', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await applicantCandidate()
    const { body } = await start(recruiter, { candidateId: String(candidate._id), body: 'Hi' })
    await read(candidate, body.conversation.id)
    await tickAt(16 * MINUTE)
    assert.equal(mailTo(candidate.email, 'new_message').length, 0)

    await send(candidate, body.conversation.id, 'Hello')
    await tickAt(16 * MINUTE)
    const [mail] = mailTo(recruiter.email, 'new_message')
    assert.equal(mail.params.sender, candidate.fullName)
    assert.match(mail.params.link, /\/recruiter\/messages\//)
  })

  it('respects the email toggle', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await listedCandidate({ notifyEmail: false })
    await start(recruiter, { candidateId: String(candidate._id), body: 'Hi' })
    await tickAt(16 * MINUTE)
    assert.equal(mailTo(candidate.email).length, 0)
    assert.equal(await EmailLog.countDocuments({ type: 'new_message', status: 'skipped_toggle' }), 1)
  })
})
