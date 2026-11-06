import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { after, before, describe, test } from 'node:test'
import mongoose from 'mongoose'
import { absolutePath, storeFile } from '../lib/files.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { setStripeClient } from '../lib/stripe.js'
import { JobRun, ScheduledTask } from '../jobs/models.js'
import { tick } from '../jobs/scheduler.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { AiCache, AiUsage, ExplanationFeedback } from '../modules/ai/ai.model.js'
import { AlertMatch, JobAlert } from '../modules/alerts/alerts.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { EmailToken, VerificationCode } from '../modules/auth/auth.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { CvAccessRequest, CvVersion } from '../modules/cv/cv.model.js'
import { CandidateNote, ProfileView, RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { Certificate, Course, Enrollment, QuizAttempt } from '../modules/learning/learning.model.js'
import { Embedding, MatchResult } from '../modules/matching/matching.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { ModerationCase } from '../modules/moderation/moderation.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { notify } from '../modules/notifications/notifications.service.js'
import { Payment, Subscription } from '../modules/payments/payments.model.js'
import { COVERAGE } from '../modules/privacy/privacy.erase.js'
import { retentionSweep } from '../modules/privacy/privacy.retention.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { image, textPdf } from './helpers/fixtures.js'
import { api, auth, createUser, PASSWORD, useTestDb, useTestUploads } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter, jobBody } from './helpers/market.js'
import { binary, readZip } from './helpers/zip.js'

/* Phase 12 (M-186 … M-190, OD15, P12-Q2 … Q7): the export ZIP, candidate erasure, recruiter deletion and the retention sweep. */
const MODELS = [
  AuditEvent, AiCache, AiUsage, ExplanationFeedback, AlertMatch, JobAlert, Application, PipelineStage, EmailToken, VerificationCode, CandidateProfile,
  Company, KycDocument, CvAccessRequest, CvVersion, CandidateNote, ProfileView, RecruiterActivity, ShortlistEntry, File, FileAccessLog, Job, SavedJob,
  Certificate, Course, Enrollment, QuizAttempt, Embedding, MatchResult, Conversation, Message, ModerationCase, Payment, Subscription, User,
  VerificationSubmission, EmailLog, ScheduledTask, JobRun,
]
useTestDb(MODELS)
useTestUploads()

/** A fake Stripe recording the erasure's calls (OD15: cancel, then delete the Customer). */
const stripeCalls = []
let stripeFails = false
before(() =>
  setStripeClient({
    subscriptions: { cancel: async (id) => stripeCalls.push(['cancel', id]) },
    customers: {
      del: async (id) => {
        if (stripeFails) throw new Error('Stripe is down')
        stripeCalls.push(['del', id])
      },
    },
  }),
)
after(() => setStripeClient())

const NOTE = 'Strong portfolio, call back in spring'
const onDisk = (file) => access(absolutePath(file)).then(() => true, () => false)

/** Two sides of the marketplace with one of every record: the candidate applied, they message, the company noted them. */
async function world() {
  const { user: recruiter, company } = await approvedRecruiter({ fullName: 'Rita Recruiter', stripeCustomerId: 'cus_rita' })
  const candidate = await applicantCandidate({ fullName: 'Emma Erased', stripeCustomerId: 'cus_emma' })
  const cvFile = await storeFile({ ownerId: candidate._id, purpose: 'cv', buffer: await textPdf(['Emma CV']), ext: 'pdf', originalName: 'emma-cv.pdf' })
  const photo = await storeFile({ ownerId: candidate._id, purpose: 'photo', buffer: await image('png'), ext: 'png', originalName: 'me.png' })
  const evidence = await storeFile({ ownerId: candidate._id, purpose: 'evidence', buffer: await image('png'), ext: 'png', originalName: 'passport.png' })
  const pdf = await storeFile({ ownerId: candidate._id, purpose: 'certificate_pdf', buffer: await textPdf(['Certificate']), ext: 'pdf', originalName: 'LWM-TEST-0001.pdf' })
  await CvVersion.updateOne({ userId: candidate._id }, { fileId: cvFile._id, originalName: 'emma-cv.pdf' })
  await CandidateProfile.updateOne({ userId: candidate._id }, { photo: { fileId: photo._id } })
  await VerificationSubmission.updateOne({ userId: candidate._id, category: 'identity' }, { fileId: evidence._id })

  const job = await Job.create({ ...jobBody(), companyId: company._id, createdBy: recruiter._id, status: 'published', country: 'GB', requiredSkills: [], preferredSkills: [] })
  const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
  const application = await Application.create({ candidateId: candidate._id, jobId: job._id, companyId: company._id, status: 'applied', stageId: stage._id, consentAt: new Date(), appliedAt: new Date(), coverNote: 'Hello Acme', history: [{ status: 'applied', stageId: stage._id, at: new Date(), actorType: 'candidate' }] })
  const conversation = await Conversation.create({ companyId: company._id, candidateId: candidate._id, jobId: job._id, startedBy: 'recruiter', lastMessageAt: new Date(), lastMessagePreview: 'Thanks' })
  await Message.create({ conversationId: conversation._id, senderId: recruiter._id, senderRole: 'recruiter', body: 'Would you like to talk?' })
  await Message.create({ conversationId: conversation._id, senderId: candidate._id, senderRole: 'candidate', body: 'Thanks, gladly' })
  await CandidateNote.create({ companyId: company._id, candidateId: candidate._id, text: NOTE, authorId: recruiter._id })
  await ShortlistEntry.create({ companyId: company._id, candidateId: candidate._id, addedBy: recruiter._id })
  await RecruiterActivity.create({ companyId: company._id, candidateId: candidate._id, actorId: recruiter._id, type: 'shortlisted', params: {}, at: new Date() })
  await ProfileView.create({ candidateId: candidate._id, recruiterId: recruiter._id, companyId: company._id, day: '2026-11-01', at: new Date() })
  await CvAccessRequest.create({ companyId: company._id, candidateId: candidate._id, requestedBy: recruiter._id, reason: 'compliance', status: 'pending' })
  await FileAccessLog.create({ fileId: cvFile._id, ownerId: candidate._id, accessorId: recruiter._id, companyId: company._id })
  await SavedJob.create({ candidateId: candidate._id, jobId: job._id })
  const alert = await JobAlert.create({ candidateId: candidate._id, name: 'Design', keywords: 'designer', frequency: 'daily', country: 'GB', language: 'en', active: true })
  await AlertMatch.create({ alertId: alert._id, jobId: job._id, mode: 'digest', sentAt: new Date() })
  await ExplanationFeedback.create({ candidateId: candidate._id, jobId: job._id, value: 'helpful' })
  await AiCache.create({ kind: 'insights', key: 'k-emma', language: 'en', output: { text: 'About Emma' }, subjectId: candidate._id })
  await AiCache.create({ kind: 'job_summary', key: 'k-job', language: 'en', output: { text: 'About the job' }, subjectId: null })
  await AiUsage.create({ userId: candidate._id, day: '2026-11-05', count: 3 })
  await Embedding.create({ ownerType: 'candidate', ownerId: candidate._id, model: 'stub', dims: 1, vector: Buffer.alloc(4), sourceHash: 'h' })
  await MatchResult.create({ jobId: job._id, candidateId: candidate._id, policyVersionId: new mongoose.Types.ObjectId(), score: 80, label: 'strong' })
  const course = await Course.create({ audience: 'candidate', title: 'Portfolio basics', status: 'published', isFree: true, lessons: [], quiz: { passMark: 70, questions: [] } })
  await Enrollment.create({ userId: candidate._id, courseId: course._id, source: 'free', enrolledAt: new Date(), lessons: [] })
  await QuizAttempt.create({ userId: candidate._id, courseId: course._id, answers: [], scorePercent: 90, passed: true, submittedAt: new Date() })
  const certificate = await Certificate.create({ code: 'LWM-TEST-0001', userId: candidate._id, courseId: course._id, holderName: 'Emma Erased', courseTitle: 'Portfolio basics', language: 'en', issuedAt: new Date(), pdfFileId: pdf._id, status: 'valid' })
  await Subscription.deleteMany({ userId: candidate._id })
  await Subscription.create({ userId: candidate._id, planKey: 'plus', status: 'active', stripeCustomerId: 'cus_emma', stripeSubscriptionId: 'sub_emma' })
  const payment = await Payment.create({ reference: 'LWM-P0001', userId: candidate._id, payerRole: 'candidate', payerName: 'Emma Erased', kind: 'subscription', itemName: 'Plus', amountMinor: 900, currency: 'GBP', status: 'paid', paidAt: new Date() })
  await notify(candidate, 'message', { params: { sender: company.displayName }, target: { kind: 'conversation', id: conversation._id } })
  await notify(recruiter, 'application_new', { params: { candidate: 'Emma Erased', job: job.title }, target: { kind: 'application', id: application._id } })
  await notify(recruiter, 'message', { params: { sender: 'Emma Erased' }, target: { kind: 'conversation', id: conversation._id } })
  await AuditEvent.create({ type: 'payments.payment_recorded', category: 'payments', actor: { type: 'user', id: candidate._id, name: 'Emma Erased' }, target: { type: 'payment', id: payment._id }, params: { payer: 'Emma Erased', reference: payment.reference }, at: new Date() })
  const reported = await ModerationCase.create({ targetType: 'job', targetId: job._id, targetName: job.title, reports: [{ reporterId: candidate._id, reason: 'spam', at: new Date() }], openedBy: 'user' })
  await EmailToken.create({ userId: candidate._id, purpose: 'reset_password', tokenHash: `t-${candidate._id}`, expiresAt: new Date(Date.now() + 3600_000) })
  await VerificationCode.create({ userId: candidate._id, channel: 'phone', target: '+442079460000', codeHash: 'c', expiresAt: new Date(Date.now() + 600_000), sentAt: new Date() })
  await EmailLog.create({ type: 'application_status', class: 'non_critical', userId: candidate._id, to: candidate.email, status: 'sent' })
  await ScheduledTask.create({ type: 'email.stage', key: `email.stage:${application._id}`, dueAt: new Date(Date.now() + 600_000), payload: { applicationId: String(application._id) } })
  return { recruiter, company, candidate, job, application, conversation, certificate, payment, reported, files: { cvFile, photo, evidence, pdf } }
}

const exportOf = async (user) => {
  const res = await api().get('/api/v1/me/export').set(auth(user)).buffer(true).parse(binary)
  assert.equal(res.status, 200)
  assert.match(res.headers['content-disposition'], /^attachment; filename="?local-workman-export-\d{4}-\d{2}-\d{2}\.zip"?$/)
  return readZip(res.body)
}
const json = (zip, name) => JSON.parse(zip[name].toString('utf8'))
const remove = (user, password = PASSWORD) => api().delete('/api/v1/me').set(auth(user)).send({ currentPassword: password })

describe('GET /me/export (M-190)', () => {
  test('candidate: every own record as JSON plus the CV, photo, evidence and certificate files; no recruiter notes', async () => {
    const { candidate } = await world()
    const zip = await exportOf(candidate)
    for (const name of ['account.json', 'profile.json', 'cv-versions.json', 'cv-requests.json', 'cv-downloads.json', 'verification.json', 'applications.json', 'conversations.json', 'saved-jobs.json', 'job-alerts.json', 'subscription.json', 'payments.json', 'learning.json', 'ai-feedback.json', 'notifications.json']) {
      assert.ok(zip[name], `${name} is in the ZIP`)
    }
    assert.equal(json(zip, 'account.json').email, candidate.email)
    assert.equal(json(zip, 'account.json').passwordHash, undefined)
    assert.equal(json(zip, 'applications.json')[0].coverNote, 'Hello Acme')
    assert.deepEqual(json(zip, 'conversations.json')[0].messages.map((message) => message.from), ['recruiter', 'candidate'])
    assert.equal(json(zip, 'payments.json')[0].reference, 'LWM-P0001')
    assert.equal(json(zip, 'job-alerts.json')[0].name, 'Design')
    assert.equal(json(zip, 'learning.json').certificates[0].code, 'LWM-TEST-0001')
    assert.equal(json(zip, 'notifications.json')[0].type, 'message')
    assert.ok(zip['files/cv/v1-emma-cv.pdf'].subarray(0, 4).toString() === '%PDF')
    assert.ok(zip['files/photo.png'] && zip['files/verification/1-identity.png'] && zip['files/certificates/LWM-TEST-0001.pdf'])
    // U31: the company's note about the candidate is nowhere in the export.
    assert.ok(Object.values(zip).every((content) => !content.toString('utf8').includes(NOTE)))
  })

  test('recruiter: account, company, jobs, notes, messages, payments, notifications, KYC files, logo and a CSV summary in their language', async () => {
    const { recruiter, company } = await world()
    await User.updateOne({ _id: recruiter._id }, { language: 'es' })
    const kyc = await storeFile({ ownerId: recruiter._id, purpose: 'kyc', buffer: await textPdf(['KYC']), ext: 'pdf', originalName: 'id.pdf' })
    await KycDocument.create({ companyId: company._id, userId: recruiter._id, type: 'identity', fileId: kyc._id, uploadedAt: new Date() })
    const logo = await storeFile({ ownerId: recruiter._id, purpose: 'company_logo', buffer: await image('png'), ext: 'png', originalName: 'logo.png' })
    await Company.updateOne({ _id: company._id }, { logoFileId: logo._id })
    await Payment.create({ reference: 'LWM-P0002', userId: recruiter._id, payerRole: 'recruiter', payerName: 'Rita Recruiter', kind: 'course', itemName: 'Hiring well', amountMinor: 2900, currency: 'GBP', status: 'paid', paidAt: new Date() })
    await Payment.create({ reference: 'LWM-P0005', userId: recruiter._id, payerRole: 'recruiter', payerName: 'Rita Recruiter', kind: 'subscription', itemId: 'recruiter_plus', itemName: 'Recruiter Plus', amountMinor: 4900, currency: 'GBP', status: 'paid', paidAt: new Date() })
    const zip = await exportOf(await User.findById(recruiter._id))
    assert.equal(json(zip, 'company.json').displayName, company.displayName)
    assert.equal(json(zip, 'jobs.json')[0].title, 'Senior Product Designer')
    assert.deepEqual(json(zip, 'notes.json').map((note) => [note.candidate, note.text]), [['Emma Erased', NOTE]])
    assert.equal(json(zip, 'conversations.json')[0].with, 'Emma Erased')
    // Phase 11c: the plan, its subscription status and every payment (the Recruiter Plus invoice and the course).
    assert.deepEqual(
      [json(zip, 'subscription.json').plan, json(zip, 'subscription.json').subscription.status],
      ['recruiter_plus', 'active'],
    )
    assert.deepEqual(json(zip, 'payments.json').map((row) => [row.reference, row.kind, row.item]).sort(), [['LWM-P0002', 'course', 'Hiring well'], ['LWM-P0005', 'subscription', 'Recruiter Plus']])
    assert.equal(json(zip, 'notifications.json').length, 2)
    assert.ok(zip['files/kyc/identity.pdf'] && zip['files/logo.png'])
    const csv = zip['summary.csv'].toString('utf8')
    assert.ok(csv.startsWith('﻿Campo,Valor\r\n'), 'OQ-6d: BOM and Spanish headers')
    assert.match(csv, /Empleos: Publicada,1\r\n/)
    assert.match(csv, /Pagado \(GBP\),78\.00\r\n/)
  })

  test('admins have no export or self-deletion', async () => {
    const admin = await createUser({ role: 'admin' })
    assert.equal((await api().get('/api/v1/me/export').set(auth(admin))).status, 403)
    assert.equal((await remove(admin)).status, 403)
    assert.equal((await api().get('/api/v1/me').set(auth(admin))).status, 200)
  })
})

describe('DELETE /me: candidate erasure (M-188, OD15)', () => {
  test('every collection is covered by the erasure plan', () => {
    const missing = mongoose.modelNames().filter((name) => !COVERAGE[name])
    assert.deepEqual(missing, [])
  })

  test('the current password is required; a wrong one changes nothing', async () => {
    const { candidate } = await world()
    const res = await remove(candidate, 'Not-The-Password-1')
    assert.equal(res.status, 422)
    assert.deepEqual(res.body.error.fields, { currentPassword: 'invalid' })
    assert.ok(await User.exists({ _id: candidate._id }))
    assert.equal(stripeCalls.length, 0)
  })

  test('a Stripe failure stops the erasure before anything is deleted', async () => {
    const { candidate } = await world()
    stripeFails = true
    try {
      assert.equal((await remove(candidate)).status, 502)
    } finally {
      stripeFails = false
    }
    const kept = await User.findById(candidate._id)
    assert.ok(kept && !kept.erasedAt)
    assert.ok(await Application.exists({ candidateId: candidate._id }))
    stripeCalls.length = 0
  })

  test('one assertion per collection', async () => {
    const w = await world()
    const { candidate } = w
    const id = candidate._id
    assert.equal((await remove(candidate)).status, 204)

    // Stripe: the subscription is cancelled at once and the Customer deleted.
    assert.deepEqual(stripeCalls.splice(0), [['cancel', 'sub_emma'], ['del', 'cus_emma']])
    // Deleted.
    assert.equal(await User.exists({ _id: id }), null)
    assert.equal(await CandidateProfile.countDocuments({ userId: id }), 0)
    assert.equal(await CvVersion.countDocuments({ userId: id }), 0)
    assert.equal(await CvAccessRequest.countDocuments({ candidateId: id }), 0)
    assert.equal(await VerificationSubmission.countDocuments({ userId: id }), 0)
    assert.equal(await File.countDocuments({ ownerId: id }), 0)
    for (const file of Object.values(w.files)) assert.equal(await onDisk(file), false, `${file.purpose} file is gone from disk`)
    assert.equal(await FileAccessLog.countDocuments({ ownerId: id }), 0)
    assert.equal(await SavedJob.countDocuments({ candidateId: id }), 0)
    assert.equal(await JobAlert.countDocuments({ candidateId: id }), 0)
    assert.equal(await AlertMatch.countDocuments({}), 0)
    assert.equal(await ExplanationFeedback.countDocuments({ candidateId: id }), 0)
    assert.equal(await AiUsage.countDocuments({ userId: id }), 0)
    assert.deepEqual((await AiCache.find({}, 'key')).map((row) => row.key), ['k-job'])
    assert.equal(await Embedding.countDocuments({ ownerId: id }), 0)
    assert.equal(await MatchResult.countDocuments({ candidateId: id }), 0)
    assert.equal(await Application.countDocuments({ candidateId: id }), 0)
    assert.equal(await ShortlistEntry.countDocuments({ candidateId: id }), 0)
    assert.equal(await CandidateNote.countDocuments({ candidateId: id }), 0)
    assert.equal(await RecruiterActivity.countDocuments({ candidateId: id }), 0)
    assert.equal(await ProfileView.countDocuments({ candidateId: id }), 0)
    assert.equal(await Enrollment.countDocuments({ userId: id }), 0)
    assert.equal(await QuizAttempt.countDocuments({ userId: id }), 0)
    assert.equal(await Subscription.countDocuments({ userId: id }), 0)
    assert.equal(await EmailToken.countDocuments({ userId: id }), 0)
    assert.equal(await VerificationCode.countDocuments({ userId: id }), 0)
    assert.equal(await EmailLog.countDocuments({ $or: [{ userId: id }, { to: candidate.email }] }), 0)
    assert.equal(await ScheduledTask.countDocuments({ type: 'email.stage' }), 0)
    assert.equal(await Notification.countDocuments({ userId: id }), 0)
    // P12-Q2: the thread stays as "Deleted user", empty and closed.
    const thread = await Conversation.findById(w.conversation._id)
    assert.ok(thread.closedAt && thread.lastMessagePreview === '' && thread.unread.recruiter === 0)
    assert.equal(await Message.countDocuments({ conversationId: thread._id }), 0)
    // Anonymised.
    const payment = await Payment.findById(w.payment._id)
    assert.ok(payment && payment.userId === null && payment.payerName === null && payment.payerRole === 'candidate')
    const certificate = await Certificate.findById(w.certificate._id)
    assert.deepEqual([certificate.code, certificate.status, certificate.userId, certificate.holderName, certificate.pdfFileId], ['LWM-TEST-0001', 'no_longer_valid', null, null, null])
    const audit = await AuditEvent.findOne({ type: 'payments.payment_recorded' })
    assert.deepEqual([audit.actor.id, audit.actor.name, audit.params.payer], [null, null, null])
    const erased = await AuditEvent.findOne({ type: 'access.account_deleted' })
    assert.deepEqual([erased.actor.type, erased.actor.id, erased.actor.name, erased.params], ['user', null, null, { accountRole: 'candidate' }])
    assert.equal((await ModerationCase.findById(w.reported._id)).reports[0].reporterId, null)
    const recruiterNotes = await Notification.find({ userId: w.recruiter._id }).sort({ type: 1 })
    assert.deepEqual(recruiterNotes.map((item) => [item.type, item.params]), [['application_new', { candidate: null, job: w.job.title }], ['message', { sender: null }]])
    // Kept: the company, its job and the catalogue entries.
    assert.ok(await Company.exists({ _id: w.company._id }))
    assert.ok(await Job.exists({ _id: w.job._id, status: 'published' }))
    assert.ok(await PipelineStage.exists({ companyId: w.company._id }))
    assert.ok(await Course.exists({}))
    // The jobs' relevant counts are refreshed (U7).
    assert.ok(await ScheduledTask.exists({ type: 'matching.recompute', key: `matching:candidate:${id}` }))
  })

  test('afterwards: no sign-in, the certificate page says no longer valid, the recruiter sees "Deleted user" and cannot reply', async () => {
    const { candidate, recruiter, conversation, application } = await world()
    await remove(candidate)
    stripeCalls.length = 0
    const login = await api().post('/api/v1/auth/login').send({ email: candidate.email, password: PASSWORD, portal: 'candidate' })
    assert.equal(login.status, 401)
    assert.equal((await api().get('/api/v1/me').set(auth(candidate))).status, 401)
    assert.deepEqual((await api().get('/api/v1/public/certificates/LWM-TEST-0001')).body, { code: 'LWM-TEST-0001', status: 'no_longer_valid' })

    const list = (await api().get('/api/v1/conversations').set(auth(recruiter))).body.items
    assert.deepEqual(list.map((item) => [item.counterpart, item.closed, item.lastMessagePreview]), [[null, true, '']])
    const reply = await api().post(`/api/v1/conversations/${conversation._id}/messages`).set(auth(recruiter)).send({ body: 'Are you there?' })
    assert.equal(reply.status, 409)
    assert.equal(reply.body.error.params.reason, 'conversation_closed')
    // P12-Q3: the recruiter's notifications about the candidate's items are no longer available.
    for (const item of await Notification.find({ userId: recruiter._id })) {
      assert.deepEqual((await api().post(`/api/v1/notifications/${item._id}/open`).set(auth(recruiter))).body, { available: false })
    }
    assert.equal((await api().get(`/api/v1/recruiter/applications/${application._id}`).set(auth(recruiter))).status, 404)
  })
})

describe('DELETE /me: recruiter deletion (M-189, OD15, OQ-6k, P12-Q5)', () => {
  test('jobs closed, display name kept, KYC files gone, payments anonymised, company activity deleted', async () => {
    const w = await world()
    const { recruiter, company, candidate } = w
    const kyc = await storeFile({ ownerId: recruiter._id, purpose: 'kyc', buffer: await textPdf(['KYC']), ext: 'pdf', originalName: 'id.pdf' })
    await KycDocument.create({ companyId: company._id, userId: recruiter._id, type: 'identity', fileId: kyc._id, uploadedAt: new Date() })
    const logo = await storeFile({ ownerId: recruiter._id, purpose: 'company_logo', buffer: await image('png'), ext: 'png', originalName: 'logo.png' })
    await Company.updateOne({ _id: company._id }, { logoFileId: logo._id, businessEmail: 'rita@acme.example', businessAddress: '1 High St' })
    await Subscription.updateOne({ userId: recruiter._id }, { stripeCustomerId: 'cus_rita', stripeSubscriptionId: 'sub_rita' })
    const plan = await Payment.create({ reference: 'LWM-P0004', userId: recruiter._id, payerRole: 'recruiter', payerName: 'Rita Recruiter', kind: 'subscription', itemId: 'recruiter_plus', itemName: 'Recruiter Plus', amountMinor: 4900, currency: 'GBP', status: 'paid', paidAt: new Date() })
    const paid = await Payment.create({ reference: 'LWM-P0003', userId: recruiter._id, payerRole: 'recruiter', payerName: 'Rita Recruiter', kind: 'course', itemName: 'Hiring well', amountMinor: 2900, currency: 'GBP', status: 'paid', paidAt: new Date() })

    assert.equal((await remove(recruiter)).status, 204)
    assert.deepEqual(stripeCalls.splice(0), [['cancel', 'sub_rita'], ['del', 'cus_rita']])
    assert.equal(await Subscription.countDocuments({ userId: recruiter._id }), 0)
    assert.equal(await User.exists({ _id: recruiter._id }), null)
    const job = await Job.findById(w.job._id)
    assert.deepEqual([job.status, job.createdBy], ['closed', null])
    const kept = await Company.findById(company._id)
    assert.ok(kept.deletedAt && kept.displayName === company.displayName && String(kept.logoFileId) === String(logo._id))
    assert.deepEqual([kept.businessEmail, kept.businessAddress], [undefined, undefined])
    assert.equal(await onDisk(kyc), false)
    assert.equal(await onDisk(logo), true)
    assert.equal(await KycDocument.countDocuments({ companyId: company._id }), 0)
    for (const row of await Payment.find({ _id: { $in: [paid._id, plan._id] } })) assert.deepEqual([row.userId, row.payerName, row.payerRole], [null, null, 'recruiter'])
    for (const Model of [CandidateNote, ShortlistEntry, RecruiterActivity, ProfileView, CvAccessRequest]) assert.equal(await Model.countDocuments({ companyId: company._id }), 0, Model.modelName)
    assert.equal(await FileAccessLog.countDocuments({ companyId: company._id }), 0)
    // The candidate keeps the application and the thread (with the company's messages), now closed for replies.
    assert.ok(await Application.exists({ _id: w.application._id }))
    assert.equal(await Message.countDocuments({ conversationId: w.conversation._id }), 2)
    const threads = (await api().get('/api/v1/conversations').set(auth(candidate))).body.items
    assert.deepEqual(threads.map((item) => [item.counterpart?.name, item.closed]), [[company.displayName, true]])
    assert.equal((await api().post(`/api/v1/conversations/${w.conversation._id}/messages`).set(auth(candidate)).send({ body: 'Hello?' })).status, 409)
    assert.equal((await AuditEvent.findOne({ type: 'access.account_deleted' })).params.accountRole, 'recruiter')
  })
})

describe('retention-sweep (M-186, U32, C18, P11b-Q5)', () => {
  test('at 03:00 it deletes due evidence and KYC files and old notifications; decisions and certificate files stay', async () => {
    const candidate = await createUser()
    // Everything is dated from the 03:00 tick below, so the test does not depend on the time it runs.
    const threeAm = new Date()
    threeAm.setHours(3, 1, 0, 0)
    const past = new Date(threeAm.getTime() - 60_000)
    const evidence = await storeFile({ ownerId: candidate._id, purpose: 'evidence', buffer: await image('png'), ext: 'png', originalName: 'id.png', deleteAfter: past })
    const notDue = await storeFile({ ownerId: candidate._id, purpose: 'evidence', buffer: await image('png'), ext: 'png', originalName: 'id2.png', deleteAfter: new Date(threeAm.getTime() + 86_400_000) })
    const certificateFile = await storeFile({ ownerId: candidate._id, purpose: 'certificate_file', buffer: await textPdf(['Cert']), ext: 'pdf', originalName: 'cert.pdf', deleteAfter: past })
    const submission = await VerificationSubmission.create({ userId: candidate._id, category: 'identity', evidenceType: 'passport', fileId: evidence._id, status: 'approved', reviewedAt: new Date(threeAm.getTime() - 31 * 86_400_000) })
    const old = await notify(candidate, 'verification_decided', { params: { decision: 'approved', category: 'identity' }, target: { kind: 'page', id: 'verification' }, at: new Date(threeAm.getTime() - 91 * 86_400_000) })
    const recent = await notify(candidate, 'verification_decided', { params: { decision: 'approved', category: 'identity' }, target: { kind: 'page', id: 'verification' }, at: new Date(threeAm.getTime() - 89 * 86_400_000) })

    // Only the sweep is due: the nightly relevance run already ran in this slot.
    await JobRun.deleteMany({})
    await JobRun.create({ name: 'relevance-nightly', lastRunAt: threeAm })
    await tick(threeAm)

    assert.equal(await onDisk(evidence), false)
    assert.equal(await File.exists({ _id: evidence._id }), null)
    const decided = await VerificationSubmission.findById(submission._id)
    assert.deepEqual([decided.status, decided.fileId], ['approved', null])
    assert.equal(await onDisk(notDue), true)
    assert.equal(await onDisk(certificateFile), true)
    assert.equal(await Notification.exists({ _id: old._id }), null)
    assert.ok(await Notification.exists({ _id: recent._id }))
    assert.ok(await JobRun.exists({ name: 'retention-sweep', lastRunAt: threeAm }))
  })

  test('the sweep returns what it removed', async () => {
    assert.deepEqual(await retentionSweep(new Date()), { files: 0, notifications: 0, interviews: 0, documentRequests: 0 })
  })
})
