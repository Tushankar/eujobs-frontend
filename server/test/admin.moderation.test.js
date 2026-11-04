import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { MatchResult } from '../modules/matching/matching.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { ModerationCase } from '../modules/moderation/moderation.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'
import { approvedRecruiter, listedCandidate } from './helpers/market.js'

/*
 * Content moderation (M-164, M-167, U20, OQ-1, P10-Q10, P10-Q12): the Report limits, one open case per target, the
 * message excerpt, Restrict and Dismiss with their effects and emails, Dismiss-only targets and "Open case" from Jobs.
 */
useTestDb([User, AuditEvent, CandidateProfile, Company, Job, File, Conversation, Message, ModerationCase, MatchResult])
before(async () => {
  await AdminRole.deleteMany({ system: false })
  await seedCatalog()
})

const v1 = '/api/v1'
const owner = () => createUser({ role: 'admin', isOwner: true, fullName: 'Workspace admin' })
const post = (user, path, body) => api().post(`${v1}${path}`).set(auth(user)).send(body)
const get = (user, path) => api().get(`${v1}${path}`).set(auth(user))
const report = (user, targetType, targetId, reason = 'scam_or_fraud', details = '') => post(user, '/reports', { targetType, targetId: String(targetId), reason, details })

async function publishedJob(fields = {}) {
  const { user, company } = await approvedRecruiter()
  const job = await Job.create({
    companyId: company._id,
    createdBy: user._id,
    title: 'Senior Product Designer',
    employmentType: 'full_time',
    brief: 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team.',
    responsibilities: ['Run research', 'Design flows', 'Ship with engineers'],
    requiredSkills: [{ name: 'Figma', key: 'figma' }],
    level: 'senior',
    experienceYears: 5,
    workPreference: 'remote',
    country: 'REMOTE',
    status: 'published',
    publishedAt: new Date(),
    firstPublishedAt: new Date(),
    ...fields,
  })
  return { recruiter: user, company, job }
}

describe('reports (M-164, U20)', () => {
  it('opens one case per target; details over 500, a repeat report and an 11th report a day are refused', async () => {
    const { job } = await publishedJob()
    const [anna, ben] = await Promise.all([createUser({ fullName: 'Anna Reporter' }), createUser({ fullName: 'Ben Reporter' })])

    const tooLong = await report(anna, 'job', job._id, 'scam_or_fraud', 'x'.repeat(501))
    assert.equal(tooLong.status, 422)
    assert.equal((await report(anna, 'job', job._id)).status, 201)
    const again = await report(anna, 'job', job._id, 'spam')
    assert.equal(again.status, 409)
    assert.deepEqual(again.body.error.params, { reason: 'already_reported' })
    assert.equal((await report(ben, 'job', job._id, 'misleading')).status, 201)

    const cases = await ModerationCase.find({ targetId: job._id })
    assert.equal(cases.length, 1)
    assert.equal(cases[0].reports.length, 2)
    const admin = await owner()
    const [item] = (await get(admin, '/admin/moderation/content')).body.items
    assert.equal(item.priority, 'high', 'scam_or_fraud makes it high priority (P10-Q10)')
    assert.deepEqual(item.reasons, ['scam_or_fraud', 'misleading'])
    assert.deepEqual(item.actions, ['dismiss', 'restrict'])

    // Ten reports a day per user: anna has 1; nine more jobs, then the 11th is limited.
    for (let index = 0; index < 9; index += 1) {
      const { job: other } = await publishedJob({ title: `Job ${index}` })
      assert.equal((await report(anna, 'job', other._id, 'spam')).status, 201)
    }
    const { job: eleventh } = await publishedJob({ title: 'Eleventh' })
    const limited = await report(anna, 'job', eleventh._id, 'spam')
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error.params.reason, 'reports_per_day')
    const spam = (await get(admin, '/admin/moderation/content')).body.items.find((entry) => entry.targetName === 'Job 0')
    assert.equal(spam.priority, 'standard')
  })

  it('lets candidates report jobs, companies and messages, and approved recruiters profiles and messages', async () => {
    const candidate = await listedCandidate({ fullName: 'Cara Candidate' })
    const { user: recruiter, company } = await approvedRecruiter()
    assert.equal((await report(candidate, 'candidate_profile', candidate._id)).status, 403)
    assert.equal((await report(recruiter, 'job', new User()._id)).status, 403)
    assert.equal((await report(recruiter, 'candidate_profile', candidate._id, 'offensive')).status, 201)
    assert.equal((await report(candidate, 'company', company._id, 'misleading')).status, 201)
    assert.equal((await report(candidate, 'job', new User()._id)).status, 404)
  })

  it('stores the reported message and up to 5 earlier ones; your own message cannot be reported', async () => {
    const candidate = await createUser({ fullName: 'Mia Messages' })
    const { user: recruiter, company } = await approvedRecruiter()
    const conversation = await Conversation.create({ companyId: company._id, candidateId: candidate._id, startedBy: 'recruiter' })
    const messages = []
    for (let index = 1; index <= 8; index += 1) {
      const fromRecruiter = index % 2 === 1
      messages.push(
        await Message.create({
          conversationId: conversation._id,
          senderId: fromRecruiter ? recruiter._id : candidate._id,
          senderRole: fromRecruiter ? 'recruiter' : 'candidate',
          body: `Message ${index}`,
          createdAt: new Date(Date.now() - (10 - index) * 60_000),
        }),
      )
    }
    assert.equal((await report(candidate, 'message', messages[7]._id)).status, 404, 'message 8 is the candidate’s own')
    assert.equal((await report(candidate, 'message', messages[6]._id, 'offensive')).status, 201)
    const stranger = await createUser()
    assert.equal((await report(stranger, 'message', messages[6]._id)).status, 404)

    const admin = await owner()
    const [item] = (await get(admin, '/admin/moderation/content')).body.items
    assert.deepEqual(item.actions, ['dismiss'], 'message cases offer Dismiss only (OQ-1)')
    const detail = (await get(admin, `/admin/moderation/content/${item.id}`)).body
    assert.deepEqual(
      detail.excerpt.map((entry) => entry.body),
      ['Message 2', 'Message 3', 'Message 4', 'Message 5', 'Message 6', 'Message 7'],
    )
    assert.deepEqual(detail.excerpt.map((entry) => entry.reported), [false, false, false, false, false, true])
    const restrict = await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'restrict', reason: 'Abusive' })
    assert.equal(restrict.status, 409)
  })
})

describe('decisions (M-167, P10-Q12)', () => {
  it('Restrict pauses and locks a job and emails the owner; Dismiss lifts the lock, the job stays paused', async () => {
    const { recruiter, job } = await publishedJob()
    const candidate = await createUser()
    await report(candidate, 'job', job._id, 'scam_or_fraud')
    const admin = await owner()
    const [item] = (await get(admin, '/admin/moderation/content')).body.items

    assert.equal((await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'restrict' })).status, 422, 'a reason is required')
    const restricted = await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'restrict', reason: 'Asks for payment up front' })
    assert.equal(restricted.status, 200)
    assert.equal(restricted.body.status, 'restricted')
    assert.deepEqual(restricted.body.actions, ['dismiss'])
    let stored = await Job.findById(job._id)
    assert.equal(stored.status, 'paused')
    assert.equal(stored.restricted.reason, 'Asks for payment up front')
    const [restrictMail] = mailTo(recruiter.email, 'content_restricted')
    assert.ok(restrictMail.text.includes('Asks for payment up front') && restrictMail.text.includes(job.title))

    const mine = await get(recruiter, `/recruiter/jobs/${job._id}`)
    assert.equal(mine.body.restricted.reason, 'Asks for payment up front', 'the recruiter sees the reason')
    const republish = await api().patch(`${v1}/recruiter/jobs/${job._id}/status`).set(auth(recruiter)).send({ status: 'published' })
    assert.equal(republish.status, 409)
    assert.equal(republish.body.error.code, 'LOCKED')

    const lifted = await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'dismiss', reason: 'Recruiter fixed the text' })
    assert.equal(lifted.body.status, 'dismissed')
    assert.deepEqual(lifted.body.actions, [])
    assert.deepEqual(lifted.body.history.map((step) => step.action), ['opened', 'restricted', 'lifted'])
    stored = await Job.findById(job._id)
    assert.equal(stored.status, 'paused')
    assert.equal(stored.restricted?.at, undefined)
    assert.equal(mailTo(recruiter.email, 'content_restriction_lifted').length, 1)
    const published = await api().patch(`${v1}/recruiter/jobs/${job._id}/status`).set(auth(recruiter)).send({ status: 'published' })
    assert.equal(published.status, 200)

    const types = (await AuditEvent.find({ category: 'moderation' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['moderation.content_reported', 'moderation.content_restricted', 'moderation.content_lifted'])
  })

  it('Restrict hides a profile from discovery and can remove the photo; Dismiss of an open case changes nothing', async () => {
    const candidate = await listedCandidate({ fullName: 'Pia Profile' })
    const photo = await File.create({ ownerId: candidate._id, purpose: 'photo', path: 'photo/none.webp', mime: 'image/webp', size: 1 })
    await CandidateProfile.updateOne({ userId: candidate._id }, { photo: { fileId: photo._id } })
    const { user: recruiter } = await approvedRecruiter()
    const admin = await owner()

    const seen = async () => (await get(recruiter, '/recruiter/candidates')).body.items.some((item) => item.id === String(candidate._id))
    assert.equal(await seen(), true)
    await report(recruiter, 'candidate_profile', candidate._id, 'misleading')
    const [item] = (await get(admin, '/admin/moderation/content')).body.items
    const detail = (await get(admin, `/admin/moderation/content/${item.id}`)).body
    assert.equal(detail.target.name, 'Pia Profile')
    assert.equal(detail.reports[0].reporter.role, 'recruiter')

    await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'restrict', reason: 'False claims', removePhoto: true })
    const profile = await CandidateProfile.findOne({ userId: candidate._id })
    assert.ok(profile.restricted.at)
    assert.equal(profile.photo?.fileId, undefined, 'the photo is removed (M-013)')
    assert.ok(profile.completeness.missing.includes('photo'))
    assert.equal(await seen(), false)
    const [mail] = mailTo(candidate.email, 'content_restricted')
    assert.ok(mail.text.includes('photo was removed'))

    await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'dismiss' })
    assert.equal((await CandidateProfile.findOne({ userId: candidate._id })).restricted?.at, undefined)

    // A fresh report opens a new case; dismissing an open case sends no email.
    await report(recruiter, 'candidate_profile', candidate._id, 'spam')
    const open = (await get(admin, '/admin/moderation/content')).body.items.find((entry) => entry.status === 'open')
    const before = mailTo(candidate.email).length
    await post(admin, `/admin/moderation/content/${open.id}/decision`, { action: 'dismiss' })
    assert.equal(mailTo(candidate.email).length, before)
    assert.deepEqual((await get(admin, '/admin/moderation/summary')).body, { contentOpen: 0, contentDecided: 2 })
  })

  it('a company case offers Dismiss only', async () => {
    const { company } = await approvedRecruiter()
    const candidate = await createUser()
    await report(candidate, 'company', company._id, 'misleading')
    const admin = await owner()
    const [item] = (await get(admin, '/admin/moderation/content')).body.items
    assert.deepEqual(item.actions, ['dismiss'])
    assert.equal((await post(admin, `/admin/moderation/content/${item.id}/decision`, { action: 'restrict', reason: 'x' })).status, 409)
  })
})

describe('Open case from admin Jobs (M-164, P10-Q4)', () => {
  it('opens a case on a job, returns the open one again, refuses drafts and lists every status with filters', async () => {
    const { job, company, recruiter } = await publishedJob({ title: 'Remote role' })
    const draft = await Job.create({ companyId: company._id, createdBy: recruiter._id, title: 'Draft role', status: 'draft' })
    await Job.create({ companyId: company._id, createdBy: recruiter._id, title: 'Paused in Berlin', status: 'paused', country: 'DE', publishedAt: new Date() })
    const admin = await owner()

    const opened = await post(admin, `/admin/jobs/${job._id}/case`, { reason: 'misleading', details: 'Salary looks wrong' })
    assert.equal(opened.status, 201)
    const again = await post(admin, `/admin/jobs/${job._id}/case`, { reason: 'spam' })
    assert.equal(again.status, 200)
    assert.equal(again.body.id, opened.body.id)
    assert.equal((await post(admin, `/admin/jobs/${draft._id}/case`, { reason: 'spam' })).status, 409)
    const detail = (await get(admin, `/admin/moderation/content/${opened.body.id}`)).body
    assert.equal(detail.openedBy, 'admin')
    assert.equal(detail.reports[0].details, 'Salary looks wrong')

    const all = (await get(admin, '/admin/jobs')).body
    assert.equal(all.total, 3)
    assert.equal(all.items.find((item) => item.id === String(job._id)).openCaseId, opened.body.id)
    assert.deepEqual((await get(admin, '/admin/jobs?status=draft')).body.items.map((item) => item.title), ['Draft role'])
    assert.deepEqual((await get(admin, '/admin/jobs?country=DE')).body.items.map((item) => item.title), ['Paused in Berlin'])
    assert.deepEqual((await get(admin, '/admin/jobs?country=remote')).body.items.map((item) => item.title), ['Remote role'])
    assert.deepEqual((await get(admin, '/admin/jobs?q=berlin')).body.items.map((item) => item.title), ['Paused in Berlin'])
    const paged = (await get(admin, '/admin/jobs?pageSize=2&page=2')).body
    assert.equal(paged.items.length, 1)
    assert.equal(paged.total, 3)
  })
})
