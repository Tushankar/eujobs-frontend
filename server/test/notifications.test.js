import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ScheduledTask } from '../jobs/models.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { AlertMatch, JobAlert } from '../modules/alerts/alerts.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { VerificationCode } from '../modules/auth/auth.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { CvAccessRequest, CvVersion } from '../modules/cv/cv.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { issueCertificate } from '../modules/learning/learning.certificates.js'
import { Certificate, Course, Enrollment } from '../modules/learning/learning.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { ModerationCase } from '../modules/moderation/moderation.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { migrateEmailToggle } from '../modules/notifications/notifications.service.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { image, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, linkToken, mailTo, PASSWORD, testEmail, useTestDb, useTestUploads } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([
  User, Company, KycDocument, Job, CandidateProfile, CvVersion, CvAccessRequest, File, VerificationSubmission, VerificationCode, Subscription,
  PipelineStage, Application, ScheduledTask, EmailLog, RecruiterActivity, Conversation, Message, JobAlert, AlertMatch, ModerationCase,
  Notification, AuditEvent, Course, Enrollment, Certificate,
])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const MINUTE = 60 * 1000
const get = (user, path) => api().get(`${v1}${path}`).set(auth(user))
const post = (user, path, body = {}) => api().post(`${v1}${path}`).set(auth(user)).send(body)
const tickAt = (ms) => api().post(`${v1}/_test/scheduler/tick`).send({ now: new Date(Date.now() + ms).toISOString() })
const feed = async (user, query = '') => (await get(user, `/notifications${query}`)).body
const counters = async (user) => (await get(user, '/me/counters')).body.notifications
const typesOf = async (user) => (await feed(user)).items.map((item) => item.type)

/** An admin holding exactly `permissions` (granted, no role); `owner` holds all. */
const admin = (permissions = [], fields = {}) => createUser({ role: 'admin', adminAccess: { granted: permissions }, ...fields })

/** An approved recruiter with one published London job. */
async function market() {
  const { user: recruiter, company } = await approvedRecruiter()
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
    firstPublishedAt: new Date(),
  })
  return { recruiter, company, job }
}

const apply = async (user, job) => (await post(user, '/candidate/applications', { jobId: String(job._id), consent: true })).body
const stage = async (company, category) => String((await PipelineStage.findOne({ companyId: company._id, category }))._id)

describe('candidate and recruiter events (P11b-Q1)', () => {
  it('application: new and withdrawn go to the recruiter only; status after the 10-minute window, collapsed, never an undone move', async () => {
    const { recruiter, company, job } = await market()
    const other = await approvedRecruiter()
    const candidate = await applicantCandidate()
    const application = await apply(candidate, job)

    const [created] = (await feed(recruiter)).items
    assert.deepEqual([created.type, created.params, created.path], ['application_new', { candidate: candidate.fullName, job: job.title }, `/recruiter/applications/${application.id}`])
    assert.equal((await feed(other.user)).total, 0)
    assert.equal((await feed(candidate)).total, 0)

    // Moved and moved back within 10 minutes: nothing; moved to interview then offer: one unread with the latest status.
    await api().patch(`${v1}/recruiter/applications/${application.id}/stage`).set(auth(recruiter)).send({ stageId: await stage(company, 'interview') })
    await api().patch(`${v1}/recruiter/applications/${application.id}/stage`).set(auth(recruiter)).send({ stageId: await stage(company, 'applied') })
    await tickAt(11 * MINUTE)
    assert.equal((await feed(candidate)).total, 0)
    await api().patch(`${v1}/recruiter/applications/${application.id}/stage`).set(auth(recruiter)).send({ stageId: await stage(company, 'interview') })
    await tickAt(5 * MINUTE)
    assert.equal((await feed(candidate)).total, 0, 'not before the window ends')
    await tickAt(11 * MINUTE)
    await api().patch(`${v1}/recruiter/applications/${application.id}/stage`).set(auth(recruiter)).send({ stageId: await stage(company, 'offer') })
    await tickAt(22 * MINUTE)
    const statuses = (await feed(candidate)).items
    assert.equal(statuses.length, 1)
    assert.deepEqual([statuses[0].type, statuses[0].params.status, statuses[0].count, statuses[0].path], ['application_status', 'offer', 2, `/candidate/applications/${application.id}`])

    await post(candidate, `/candidate/applications/${application.id}/withdraw`)
    assert.deepEqual(await typesOf(recruiter), ['application_withdrawn', 'application_new'])
  })

  it('messages: one unread per conversation with the count, for the other side only; reading the thread clears it', async () => {
    const { recruiter, company, job } = await market()
    const candidate = await applicantCandidate()
    await apply(candidate, job)
    const started = await post(recruiter, '/conversations', { candidateId: String(candidate._id), body: 'Hello there' })
    const id = started.body.conversation.id
    await post(recruiter, `/conversations/${id}/messages`, { body: 'Are you free on Monday?' })
    const [message] = (await feed(candidate)).items
    assert.deepEqual([message.type, message.params.sender, message.count, message.path], ['message', company.displayName, 2, `/candidate/messages/${id}`])
    assert.equal((await typesOf(recruiter)).includes('message'), false)
    assert.equal((await counters(candidate)).sections.messages, 1)

    await post(candidate, `/conversations/${id}/read`)
    assert.equal((await counters(candidate)).unread, 0)
    await post(recruiter, `/conversations/${id}/messages`, { body: 'One more thing' })
    const after = (await feed(candidate)).items.filter((item) => item.type === 'message')
    assert.deepEqual(after.map((item) => [item.read, item.count]), [[false, 1], [true, 2]], 'once read, the next message starts a new one')

    await post(candidate, `/conversations/${id}/messages`, { body: 'Monday works' })
    assert.equal((await feed(recruiter)).items[0].params.sender, candidate.fullName)
  })

  it('CV request and its decision', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const candidate = await listedCandidate()
    await post(recruiter, `/recruiter/candidates/${candidate._id}/cv-requests`, { reason: 'verify_employment' })
    const [request] = (await feed(candidate)).items
    assert.deepEqual([request.type, request.params, request.path], ['cv_request', { company: company.displayName, reason: 'verify_employment' }, '/candidate/cv-versions'])

    const pending = await CvAccessRequest.findOne({ candidateId: candidate._id })
    await post(candidate, `/candidate/cv/requests/${pending._id}/decision`, { decision: 'declined' })
    const [decided] = (await feed(recruiter)).items
    assert.deepEqual([decided.type, decided.params.decision, decided.path], ['cv_request_decided', 'declined', `/recruiter/find-candidates/${candidate._id}`])
  })

  it('verification decision to the candidate; account decisions to the recruiter', async () => {
    const owner = await admin([], { isOwner: true })
    const candidate = await createUser()
    const submission = await VerificationSubmission.create({ userId: candidate._id, category: 'identity', evidenceType: 'passport', status: 'in_review' })
    await post(owner, `/admin/moderation/verification/${submission._id}/decision`, { decision: 'rejected', reason: 'Blurred' })
    const [decision] = (await feed(candidate)).items
    assert.deepEqual([decision.type, decision.params, decision.path], ['verification_decided', { decision: 'rejected', category: 'identity' }, '/candidate/verification'])

    const { user: recruiter } = await approvedRecruiter({ status: 'pending_review' })
    await post(owner, `/admin/moderation/accounts/${recruiter._id}/decision`, { decision: 'rejected', reason: 'Unreadable' })
    await User.updateOne({ _id: recruiter._id }, { status: 'pending_review' })
    await post(owner, `/admin/moderation/accounts/${recruiter._id}/decision`, { decision: 'approved' })
    const paths = (await feed(await User.findById(recruiter._id))).items.map((item) => [item.params.decision, item.path])
    assert.deepEqual(paths, [['approved', '/recruiter'], ['rejected', '/recruiter/onboarding/review']])
  })

  it('job alerts: Plus only, at first publish for every frequency, one per job', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const plus = await createUser()
    await Subscription.create({ userId: plus._id, planKey: 'plus', status: 'active' })
    const free = await createUser()
    for (const [user, frequency] of [[plus, 'instant'], [plus, 'weekly'], [free, 'instant']]) {
      await JobAlert.create({ candidateId: user._id, name: `Design ${frequency}`, keywords: 'designer', frequency, country: 'GB', language: 'en', active: true })
    }
    const draft = await post(recruiter, '/recruiter/jobs', jobBody())
    await api().patch(`${v1}/recruiter/jobs/${draft.body.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    await tickAt(0)
    const items = (await feed(plus)).items
    assert.deepEqual(items.map((item) => [item.type, item.count, item.path]), [['job_alert', 1, `/candidate/jobs/${draft.body.id}`]])
    assert.equal((await feed(free)).total, 0)
  })

  it('restricted and lifted content: the job owner opens the job, the candidate their profile', async () => {
    const owner = await admin([], { isOwner: true })
    const { recruiter, job } = await market()
    const reporter = await createUser()
    await post(reporter, '/reports', { targetType: 'job', targetId: String(job._id), reason: 'misleading' })
    const item = await ModerationCase.findOne({ targetId: job._id })
    await post(owner, `/admin/moderation/content/${item._id}/decision`, { action: 'restrict', reason: 'Misleading pay' })
    await post(owner, `/admin/moderation/content/${item._id}/decision`, { action: 'dismiss' })
    const items = (await feed(recruiter)).items.map((entry) => [entry.type, entry.params.content, entry.path])
    assert.deepEqual(items, [
      ['content_lifted', 'job', `/recruiter/jobs/${job._id}`],
      ['content_restricted', 'job', `/recruiter/jobs/${job._id}`],
    ])

    const candidate = await listedCandidate()
    await post(recruiter, '/reports', { targetType: 'candidate_profile', targetId: String(candidate._id), reason: 'misleading' })
    const profileCase = await ModerationCase.findOne({ targetId: candidate._id })
    await post(owner, `/admin/moderation/content/${profileCase._id}/decision`, { action: 'restrict', reason: 'Fake' })
    assert.deepEqual((await feed(candidate)).items.map((entry) => [entry.type, entry.path]), [['content_restricted', '/candidate/profile']])
  })

  it('certificate issued opens the course page', async () => {
    const user = await createUser()
    const course = await Course.create({ audience: 'candidate', title: 'Interviewing well', status: 'published' })
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'free' })
    const certificate = await issueCertificate(user, course)
    const [item] = (await feed(user)).items
    assert.deepEqual([item.type, item.params, item.path], ['certificate_issued', { course: course.title, code: certificate.code }, `/candidate/learning/${course._id}`])
  })
})

describe('admin events: only admins whose permission covers them (P11b-Q1, Q4, Q12)', () => {
  it('recruiter submitted / resubmitted: moderation.manage and the Owner, with their email at once', async () => {
    const owner = await admin([], { isOwner: true })
    const moderator = await admin(['moderation.manage'], { language: 'fr' })
    const finance = await admin(['finance.view', 'users.view'])
    const reserved = await admin(['moderation.manage'], { email: `mod.${Date.now()}@example.com` })
    const recruiter = await createUser({ role: 'recruiter', status: 'onboarding', jobTitle: 'Talent lead', phone: { e164: '+493090182000' } })
    await api().put(`${v1}/recruiter/onboarding/company`).set(auth(recruiter)).send({
      legalName: 'Nordlicht Studio GmbH',
      website: 'nordlicht.example',
      businessEmail: 'hello@nordlicht.example',
      industry: 'Design services',
      size: '11_50',
      placeId: PLACES.berlin.placeId,
      businessAddress: 'Torstraße 1, 10119 Berlin',
    })
    for (const type of ['identity', 'registration']) {
      await attach(api().post(`${v1}/recruiter/onboarding/documents`).set(auth(recruiter)), await textPdf('Document'), `${type}.pdf`, 'application/pdf', { type })
    }
    const { code } = (await post(recruiter, '/recruiter/onboarding/phone/code', { phone: '+49 30 901820' })).body
    await post(recruiter, '/recruiter/onboarding/phone/confirm', { code })
    assert.equal((await post(recruiter, '/recruiter/onboarding/submit')).status, 200)

    for (const reader of [owner, moderator, reserved]) {
      const [item] = (await feed(reader)).items
      assert.deepEqual([item.type, item.params.resubmitted, item.path], ['admin_account_review', false, `/admin/moderation/accounts/${recruiter._id}`])
    }
    assert.equal((await feed(finance)).total, 0)
    assert.equal(mailTo(finance.email).length, 0)
    const [mail] = mailTo(moderator.email, 'admin_account_review')
    assert.equal(mail.language, 'fr')
    assert.match(mail.params.summary, /a soumis son compte recruteur/)
    assert.equal(mailTo(owner.email, 'admin_account_review').length, 1)
    assert.equal(mailTo(reserved.email).length, 0)
    assert.equal(await EmailLog.countDocuments({ to: reserved.email, status: 'suppressed_reserved' }), 1)

    await post(owner, `/admin/moderation/accounts/${recruiter._id}/decision`, { decision: 'rejected', reason: 'Unreadable' })
    await post(recruiter, '/recruiter/onboarding/submit')
    assert.equal((await feed(moderator)).items[0].params.resubmitted, true)
  })

  it('verification submitted and content reports (one unread per case, an email per report)', async () => {
    const moderator = await admin(['moderation.manage'])
    const viewer = await admin(['users.view', 'candidates.view'])
    const candidate = await createUser()
    await attach(api().post(`${v1}/candidate/verification/submissions`).set(auth(candidate)), await image('jpeg'), 'passport.jpg', 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    const submission = await VerificationSubmission.findOne({ userId: candidate._id })
    const [verification] = (await feed(moderator)).items
    assert.deepEqual([verification.type, verification.params, verification.path], ['admin_verification_submitted', { candidate: candidate.fullName, category: 'identity' }, `/admin/moderation/verification/${submission._id}`])

    const { job } = await market()
    for (const reason of ['spam', 'misleading']) await post(await createUser(), '/reports', { targetType: 'job', targetId: String(job._id), reason })
    const item = await ModerationCase.findOne({ targetId: job._id })
    const reports = (await feed(moderator)).items.filter((entry) => entry.type === 'admin_content_report')
    assert.deepEqual(reports.map((entry) => [entry.count, entry.params.reason, entry.path]), [[2, 'misleading', `/admin/moderation/content/${item._id}`]])
    assert.equal(mailTo(moderator.email, 'admin_content_report').length, 2)
    assert.equal((await feed(viewer)).total, 0)
  })

  it('invited admin joined: roles.view holders except the new admin', async () => {
    const owner = await admin([], { isOwner: true })
    const roles = await admin(['roles.view'])
    const other = await admin(['moderation.manage'])
    const role = await AdminRole.findOne({ name: 'Manager' })
    const email = testEmail('invitee')
    await post(owner, '/admin/invitations', { email, fullName: 'Nia Invitee', roleId: String(role._id), department: '' })
    await api().post(`${v1}/auth/invite/accept`).send({ token: linkToken(email, 'admin_invite'), password: PASSWORD })
    const joined = await User.findOne({ email })
    for (const reader of [owner, roles]) {
      const [item] = (await feed(reader)).items
      assert.deepEqual([item.type, item.params.name, item.path], ['admin_joined', 'Nia Invitee', `/admin/access-management/users/${joined._id}`])
      assert.equal(mailTo(reader.email, 'admin_joined').length, 1)
    }
    assert.equal((await feed(other)).total, 0)
    assert.equal((await feed(joined)).total, 0, 'Manager holds roles.view, but the new admin is not told about themself')
  })

  it('an admin who loses the permission no longer sees those notifications', async () => {
    const moderator = await admin(['moderation.manage'])
    const candidate = await createUser()
    await attach(api().post(`${v1}/candidate/verification/submissions`).set(auth(candidate)), await image('jpeg'), 'passport.jpg', 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    const [item] = (await feed(moderator)).items
    await User.updateOne({ _id: moderator._id }, { 'adminAccess.granted': ['users.view'] })
    const reader = await User.findById(moderator._id)
    assert.deepEqual([(await feed(reader)).total, (await counters(reader)).unread], [0, 0])
    assert.deepEqual((await post(reader, `/notifications/${item.id}/open`)).body, { available: false })
  })
})

describe('reading notifications (P11b-Q2, Q4, Q10)', () => {
  it('lists newest first with All/Unread, opens with the path and marks read, counts per section, marks all read', async () => {
    const { recruiter, job } = await market()
    const applications = []
    for (let i = 0; i < 3; i += 1) applications.push(await apply(await applicantCandidate(), job))
    const all = await feed(recruiter)
    assert.deepEqual([all.total, all.unread, all.items[0].path], [3, 3, `/recruiter/applications/${applications[2].id}`])
    assert.deepEqual(await counters(recruiter), { unread: 3, sections: { applications: 3 } })
    assert.equal((await feed(recruiter, '?pageSize=2')).items.length, 2)

    const opened = await post(recruiter, `/notifications/${all.items[0].id}/open`)
    assert.deepEqual(opened.body, { available: true, path: `/recruiter/applications/${applications[2].id}` })
    assert.deepEqual([(await feed(recruiter, '?filter=unread')).total, (await counters(recruiter)).sections.applications], [2, 2])

    // Opening the item itself (from its page) clears its notifications too.
    assert.equal((await post(recruiter, '/notifications/seen', { kind: 'application', id: applications[1].id })).status, 204)
    assert.equal((await counters(recruiter)).unread, 1)

    assert.equal((await post(recruiter, '/notifications/read-all')).status, 204)
    assert.deepEqual(await counters(recruiter), { unread: 0, sections: {} })
    assert.equal((await feed(recruiter, '?filter=unread')).total, 0)
  })

  it('is visible to its own user only', async () => {
    const { recruiter, job } = await market()
    const other = await approvedRecruiter()
    await apply(await applicantCandidate(), job)
    const [item] = (await feed(recruiter)).items
    assert.deepEqual((await post(other.user, `/notifications/${item.id}/open`)).body, { available: false })
    assert.equal((await feed(recruiter, '?filter=unread')).total, 1, 'another user opening it changed nothing')
    await post(other.user, '/notifications/read-all')
    assert.equal((await feed(recruiter, '?filter=unread')).total, 1)
  })

  it('an item that is gone or no longer open answers "no longer available"', async () => {
    const { recruiter, job } = await market()
    const candidate = await applicantCandidate()
    const application = await apply(candidate, job)
    const [item] = (await feed(recruiter)).items
    await Application.deleteOne({ _id: application.id })
    assert.deepEqual((await post(recruiter, `/notifications/${item.id}/open`)).body, { available: false })
    assert.equal((await feed(recruiter, '?filter=unread')).total, 0, 'it is marked read anyway')

    // A job alert whose job closed (the candidate never saved or applied to it).
    const plus = await createUser()
    await Subscription.create({ userId: plus._id, planKey: 'plus', status: 'active' })
    await JobAlert.create({ candidateId: plus._id, name: 'Design', keywords: 'designer', frequency: 'daily', country: 'GB', language: 'en', active: true })
    const draft = await post(recruiter, '/recruiter/jobs', jobBody())
    await api().patch(`${v1}/recruiter/jobs/${draft.body.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    await tickAt(0)
    const [alert] = (await feed(plus)).items
    assert.equal((await post(plus, `/notifications/${alert.id}/open`)).body.available, true)
    await api().patch(`${v1}/recruiter/jobs/${draft.body.id}/status`).set(auth(recruiter)).send({ status: 'closed' })
    assert.deepEqual((await post(plus, `/notifications/${alert.id}/open`)).body, { available: false })
  })

  it('GET /recruiter/applications/:id: one own row whatever its status (P11b-Q9)', async () => {
    const { recruiter, job } = await market()
    const other = await approvedRecruiter()
    const candidate = await applicantCandidate()
    const application = await apply(candidate, job)
    await post(candidate, `/candidate/applications/${application.id}/withdraw`)
    const row = await get(recruiter, `/recruiter/applications/${application.id}`)
    assert.deepEqual([row.status, row.body.status, row.body.job.id, row.body.candidate.id], [200, 'withdrawn', String(job._id), String(candidate._id)])
    assert.equal((await get(other.user, `/recruiter/applications/${application.id}`)).status, 404)
  })

  it('validates ids and the filter', async () => {
    const user = await createUser()
    assert.equal((await post(user, '/notifications/not-an-id/open')).status, 422)
    assert.equal((await get(user, '/notifications?filter=read')).status, 422)
    assert.equal((await api().get(`${v1}/notifications`)).status, 401)
  })
})

describe('email switches (P11b-Q3, Q12)', () => {
  it('each role sees its own categories, on by default; PATCH saves them', async () => {
    const candidate = await createUser()
    const me = (await get(candidate, '/me')).body
    assert.deepEqual(me.emailSwitches, { applications: true, messages: true, cv_requests: true, job_alerts: true })
    const saved = await api().patch(`${v1}/me/notifications`).set(auth(candidate)).send({ emailSwitches: { messages: false } })
    assert.deepEqual(saved.body.emailSwitches, { applications: true, messages: false, cv_requests: true, job_alerts: true })
    const again = await api().patch(`${v1}/me/notifications`).set(auth(candidate)).send({ emailSwitches: { job_alerts: false } })
    assert.equal(again.body.emailSwitches.messages, false, 'other categories keep their value')

    const owner = await admin([], { isOwner: true })
    assert.deepEqual(Object.keys((await get(owner, '/me')).body.emailSwitches), ['account_reviews', 'verification', 'content_reports', 'failed_renewals', 'admin_joined'])
    const { user: recruiter } = await approvedRecruiter()
    assert.deepEqual(Object.keys((await get(recruiter, '/me')).body.emailSwitches), ['new_applications', 'messages'])
    const bad = await api().patch(`${v1}/me/notifications`).set(auth(candidate)).send({ emailSwitches: { messages: 'no' } })
    assert.equal(bad.status, 422)
  })

  it('a switched-off category is skipped while the in-app notification still shows; always-on emails ignore the switches', async () => {
    const moderator = await admin(['moderation.manage'])
    await api().patch(`${v1}/me/notifications`).set(auth(moderator)).send({ emailSwitches: { verification: false } })
    const candidate = await createUser()
    await api().patch(`${v1}/me/notifications`).set(auth(candidate)).send({ emailSwitches: { applications: false, messages: false, cv_requests: false, job_alerts: false } })
    await attach(api().post(`${v1}/candidate/verification/submissions`).set(auth(candidate)), await image('jpeg'), 'passport.jpg', 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    assert.equal((await feed(moderator)).total, 1)
    assert.equal(mailTo(moderator.email).length, 0)
    assert.equal(await EmailLog.countDocuments({ to: moderator.email, type: 'admin_verification_submitted', status: 'skipped_toggle' }), 1)

    // The candidate switched everything off: the verification decision (always on) is still emailed.
    const submission = await VerificationSubmission.findOne({ userId: candidate._id })
    await post(await admin([], { isOwner: true }), `/admin/moderation/verification/${submission._id}/decision`, { decision: 'approved' })
    assert.equal(mailTo(candidate.email, 'verification_approved').length, 1)

    // The CV request is non-critical: skipped, in-app shown.
    const { user: recruiter } = await approvedRecruiter()
    const listed = await listedCandidate()
    await api().patch(`${v1}/me/notifications`).set(auth(listed)).send({ emailSwitches: { cv_requests: false } })
    await post(recruiter, `/recruiter/candidates/${listed._id}/cv-requests`, { reason: 'compliance' })
    assert.deepEqual([(await feed(listed)).total, mailTo(listed.email, 'cv_request').length], [1, 0])
  })

  it('copies the former single toggle into every category of the role', async () => {
    const off = await createUser()
    const on = await createUser({ role: 'recruiter' })
    await User.collection.updateOne({ _id: off._id }, { $set: { notifyEmail: false } })
    await User.collection.updateOne({ _id: on._id }, { $set: { notifyEmail: true } })
    await migrateEmailToggle()
    const [offRow, onRow] = await Promise.all([User.collection.findOne({ _id: off._id }), User.collection.findOne({ _id: on._id })])
    assert.deepEqual([offRow.emailOff, offRow.notifyEmail], [['applications', 'messages', 'cv_requests', 'job_alerts'], undefined])
    assert.deepEqual([onRow.emailOff, onRow.notifyEmail], [undefined, undefined])
  })
})
