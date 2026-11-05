import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { before, describe, it } from 'node:test'
import { DateTime } from 'luxon'
import mongoose from 'mongoose'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { periodRange } from '../modules/admin/admin.metrics.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { MatchResult } from '../modules/matching/matching.model.js'
import { Conversation } from '../modules/messages/messages.model.js'
import { ReportExport } from '../modules/reports/reports.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { api, attach, auth, createUser, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedRecruiter, listedCandidate } from './helpers/market.js'

/*
 * Admin numbers (§3.15, OQ-5, M-170 … M-180, M-138): Overview, Analytics, the activity buckets and Recruitment against
 * fixtures and against the other admin pages; Applications (P10-Q14) with its export; Reports (M-181 … M-183, U23) with
 * the transcription fallback, the stored snapshot and the audit events.
 */
useTestDb([User, AuditEvent, CandidateProfile, Company, Job, Application, PipelineStage, ShortlistEntry, Conversation, MatchResult, VerificationSubmission, ReportExport, File])
useTestUploads()
before(async () => {
  await AdminRole.deleteMany({ system: false })
  await seedCatalog()
})

const v1 = '/api/v1'
const owner = (fields) => createUser({ role: 'admin', isOwner: true, fullName: 'Workspace admin', ...fields })
const get = (admin, path) => api().get(`${v1}${path}`).set(auth(admin))
const policyVersionId = new mongoose.Types.ObjectId()

async function job(company, recruiter, fields) {
  return Job.create({
    companyId: company._id,
    createdBy: recruiter._id,
    title: 'Product Designer',
    requiredSkills: [{ name: 'Figma', key: 'figma' }],
    status: 'published',
    country: company.location.countryCode,
    publishedAt: new Date(),
    firstPublishedAt: new Date(),
    ...fields,
  })
}

async function apply(candidate, target, company, categories, status = 'applied') {
  const stages = await PipelineStage.find({ companyId: company._id })
  const stage = (category) => stages.find((item) => item.category === category)
  const at = new Date()
  return Application.create({
    candidateId: candidate._id,
    jobId: target._id,
    companyId: company._id,
    status,
    stageId: stage(categories.at(-1))._id,
    consentAt: at,
    appliedAt: at,
    history: categories.map((category) => ({ status: 'applied', stageId: stage(category)._id, stageName: stage(category).name, category, at, actorType: 'recruiter' })),
  })
}

/** Three candidates (2 GB, 1 DE, one Verified), an approved GB recruiter, a pending DE recruiter, jobs, applications. */
async function market() {
  const anna = await listedCandidate({ fullName: 'Anna London' })
  for (const category of ['identity', 'academic', 'employment']) await VerificationSubmission.create({ userId: anna._id, category, status: 'approved', submittedAt: new Date() })
  const ben = await listedCandidate({ fullName: 'Ben London' })
  const carl = await listedCandidate({ fullName: 'Carl Berlin', city: 'berlin' })
  const { user: recruiter, company } = await approvedRecruiter({ fullName: 'Rita Recruiter' })
  const pending = await approvedRecruiter({ fullName: 'Paul Pending', city: 'berlin', status: 'pending_review' })
  const design = await job(company, recruiter, { title: 'Senior Designer', requiredSkills: [{ name: 'Figma', key: 'figma' }, { name: 'Research', key: 'research' }] })
  const growth = await job(company, recruiter, { title: 'Growth Designer' })
  await job(pending.company, pending.user, { title: 'Berlin Designer' })
  await job(company, recruiter, { title: 'Paused role', status: 'paused' })
  await job(company, recruiter, { title: 'Draft role', status: 'draft' })
  await MatchResult.insertMany([
    ...[90, 80, 70, 60, 50, 40].map((score) => ({ jobId: design._id, candidateId: new mongoose.Types.ObjectId(), policyVersionId, score })),
    { jobId: growth._id, candidateId: new mongoose.Types.ObjectId(), policyVersionId, score: 60 },
  ])
  await apply(anna, design, company, ['applied', 'screening', 'interview'], 'interview')
  await apply(ben, design, company, ['applied'])
  await apply(carl, growth, company, ['applied', 'screening'], 'withdrawn')
  await ShortlistEntry.create({ companyId: company._id, candidateId: anna._id, addedBy: recruiter._id })
  await Conversation.create({ companyId: company._id, candidateId: anna._id, startedBy: 'recruiter' })
  return { anna, ben, carl, recruiter, company }
}

describe('Overview and Analytics (§3.15, OQ-5)', () => {
  it('counts every KPI from the database, agrees with the other admin pages and follows the country filter', async () => {
    await market()
    const admin = await owner()
    const { kpis, health, skills, recent } = (await get(admin, '/admin/overview')).body
    assert.deepEqual(kpis, {
      candidateRegistrations: 3,
      activeUsers: 4,
      publishedJobs: 3,
      applications: 2,
      verifiedProfiles: 1,
      courseEnrollments: 0,
      courseBadges: 0,
      averageRoleMatch: { value: 65, roles: 3 },
    })
    // P11c-Q20: the Payments card count, by role (the factory recruiters are on Recruiter Plus).
    assert.deepEqual(health, { companies: 2, coursePurchases: 0, checksInReview: 0, shortlists: 1, outreach: 1, pendingReviews: 1, activeSubscribers: { total: 2, candidate: 0, recruiter: 2 } })
    assert.deepEqual(skills[0], { skill: 'Figma', roles: 3 })
    assert.ok(recent.length <= 5)

    // The same numbers on the pages that list them.
    const total = async (path) => (await get(admin, path)).body.total
    assert.equal(await total('/admin/users?role=candidate'), kpis.candidateRegistrations)
    assert.equal((await total('/admin/users?role=candidate&status=active')) + (await total('/admin/users?role=recruiter&status=active')), kpis.activeUsers)
    assert.equal(await total('/admin/users?role=candidate&verification=verified'), kpis.verifiedProfiles)
    assert.equal(await total('/admin/jobs?status=published'), kpis.publishedJobs)

    const germany = (await get(admin, '/admin/overview?country=DE')).body
    assert.equal(germany.kpis.candidateRegistrations, 1)
    assert.equal(germany.kpis.publishedJobs, 1)
    assert.equal(germany.kpis.applications, 0)
    assert.equal(germany.health.pendingReviews, 1)
    assert.equal(germany.health.companies, 1)
    assert.deepEqual(germany.kpis.averageRoleMatch, { value: null, roles: 1 })
    assert.equal(await total('/admin/jobs?status=published&country=DE'), germany.kpis.publishedJobs)

    const analytics = (await get(admin, '/admin/analytics')).body
    assert.deepEqual(analytics.shortlistConversion, { percent: 50, shortlisted: 1, applications: 2 }, 'U11: shortlisted ÷ non-withdrawn')
    assert.equal(analytics.recruiterAccounts, 2)
    assert.equal(analytics.companyRegistrations, 2)
    assert.equal(analytics.reviewedOutreach, 1)
  })

  it('buckets the chart by day for a week and by ISO week for last month, in the browser time zone', async () => {
    const now = DateTime.fromISO('2026-11-04T10:00:00', { zone: 'Europe/Madrid' })
    const week = periodRange('this_week', 'Europe/Madrid', now)
    assert.equal(week.start.toISODate(), '2026-11-02')
    assert.equal(periodRange('last_week', 'Europe/Madrid', now).start.toISODate(), '2026-10-26')
    const month = periodRange('last_month', 'Europe/Madrid', now)
    assert.equal(month.start.toISODate(), '2026-10-01')
    assert.equal(month.end.toISODate(), '2026-11-01')

    await market()
    const admin = await owner()
    const zone = 'Asia/Calcutta'
    const today = DateTime.now().setZone(zone).toISODate()
    const res = await get(admin, `/admin/activity?period=this_week&tz=${encodeURIComponent(zone)}`)
    assert.equal(res.body.buckets.length, 7)
    const bucket = res.body.buckets.find((item) => item.start === today)
    assert.equal(bucket.registrations, 5, 'three candidates and two recruiters signed up today')
    assert.equal(bucket.applications, 3, 'every application counts on the day it was sent')
    const last = (await get(admin, `/admin/activity?period=last_month&tz=${encodeURIComponent(zone)}`)).body
    assert.equal(last.unit, 'week')
    assert.ok(last.buckets.length >= 4 && last.buckets.length <= 6)
    assert.equal((await get(admin, '/admin/activity?period=this_week&tz=Mars/Base')).status, 422)
  })
})

describe('Recruitment (M-178, P10-Q13)', () => {
  it('shows current stage counts, the ever-reached funnel without withdrawn applications, and the movement rows', async () => {
    const { anna } = await market()
    const admin = await owner()
    const body = (await get(admin, '/admin/recruitment')).body
    const of = (list) => Object.fromEntries(list.map((item) => [item.category, item.count]))
    assert.deepEqual(of(body.stages), { applied: 1, screening: 0, shortlisted: 0, interview: 1, offer: 0, hired: 0 })
    assert.deepEqual(of(body.funnel), { applied: 2, screening: 1, shortlisted: 0, interview: 1, offer: 0, hired: 0 })
    assert.deepEqual(body.stats, { publishedRoles: 3, applications: 2, shortlisted: 1, reviewedOutreach: 1 })
    const row = body.movement.find((item) => item.candidate.id === String(anna._id))
    assert.equal(row.category, 'interview')
    assert.equal(row.shortlisted, true)
    assert.equal(row.outreach, true)
    assert.equal(body.movement.length, 2)
    assert.equal((await get(admin, '/admin/recruitment?country=DE')).body.stats.applications, 0)
  })
})

describe('Applications (M-206, P10-Q14)', () => {
  it('filters by status, job country and text, pages, and exports in the admin language with an audit event', async () => {
    await market()
    const admin = await owner({ language: 'es' })
    assert.equal((await get(admin, '/admin/applications')).body.total, 3)
    assert.deepEqual((await get(admin, '/admin/applications?status=withdrawn')).body.items.map((row) => row.candidate.name), ['Carl Berlin'])
    assert.equal((await get(admin, '/admin/applications?q=growth')).body.total, 1)
    assert.equal((await get(admin, '/admin/applications?country=DE')).body.total, 0)
    const page = (await get(admin, '/admin/applications?pageSize=2&page=2')).body
    assert.equal(page.items.length, 1)

    const csv = await get(admin, '/admin/applications/export?status=interview').buffer(true)
    const text = csv.text ?? csv.body.toString()
    assert.ok(text.startsWith('﻿Candidato,Oferta,Empresa'), text.slice(0, 40))
    assert.ok(text.includes('Entrevista'))
    assert.equal(text.trim().split('\r\n').length, 2)
    const [event] = await AuditEvent.find({ type: 'reports.applications_exported' })
    assert.equal(event.params.count, 1)
  })
})

describe('Reports (M-181 … M-183, U23)', () => {
  const mp3 = () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(4000)])
  const create = (admin, fields, voice = true) => {
    const req = api().post(`${v1}/admin/reports`).set(auth(admin))
    return voice ? attach(req, mp3(), 'note.mp3', 'audio/mpeg', fields) : req.field('type', fields.type).field('period', fields.period).field('tz', fields.tz)
  }

  it('transcribes the voice note (whisper-1 when the main model fails), stores a U23 snapshot and serves the same bytes', async () => {
    await market()
    const admin = await owner()
    aiStub.reset()
    aiStub.failingTranscribeModels = ['stub-transcribe']
    aiStub.reply = () => ({ summary: 'Two active applications this week.' })
    const res = await create(admin, { type: 'marketplace_summary', period: 'last_week', brief: 'Focus on interviews', tz: 'Europe/Madrid' })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.transcript, 'stub transcript (whisper-1)')
    assert.equal(res.body.aiSummary, 'Two active applications this week.')
    assert.deepEqual(
      aiStub.calls.filter((call) => call.kind === 'transcription').map((call) => call.model),
      ['stub-transcribe', 'whisper-1'],
    )
    assert.ok(res.body.filename.startsWith('marketplace-summary-'))

    const download = async () => {
      const file = await get(admin, `/admin/reports/${res.body.id}/download`).buffer(true)
      return Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.text, 'utf8')
    }
    const first = await download()
    const second = await download()
    const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
    assert.equal(hash(first), hash(second), 'Download again serves the stored snapshot')
    const rows = first.toString('utf8').replace(/^﻿/, '').split('\r\n')
    assert.equal(rows[0], 'Executive summary')
    assert.equal(rows[1], 'Two active applications this week.')
    assert.equal(rows[2], 'Brief')
    assert.ok(rows[3].startsWith('"Focus on interviews'))
    assert.ok(first.toString('utf8').includes('Voice note transcript: stub transcript (whisper-1)'))
    assert.ok(first.toString('utf8').includes('Metric,In period,All time'))
    assert.ok(first.toString('utf8').includes('Applications (not withdrawn),0,2'), 'none sent last week, 2 all time')

    const list = (await get(admin, '/admin/reports')).body
    assert.equal(list.items.length, 1)
    const types = (await AuditEvent.find({ category: 'reports' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['reports.report_generated', 'reports.report_downloaded', 'reports.report_downloaded'])
  })

  it('stores nothing when the summary fails, and needs reports.export to generate', async () => {
    const admin = await owner()
    aiStub.reset()
    aiStub.reply = () => {
      throw new Error('stub failure')
    }
    const failed = await create(admin, { type: 'skills_demand', period: 'this_week', tz: 'Europe/Madrid' })
    assert.equal(failed.status, 503)
    assert.equal(await ReportExport.countDocuments(), 0)
    assert.equal(await File.countDocuments({ purpose: { $in: ['report_voice', 'report_csv'] } }), 0)
    aiStub.reset()

    const viewer = await createUser({ role: 'admin', adminAccess: { granted: ['reports.view'] } })
    const denied = await create(viewer, { type: 'skills_demand', period: 'this_week', tz: 'Europe/Madrid' }, false)
    assert.equal(denied.status, 403)
    assert.deepEqual(denied.body.error.params, { permission: 'reports.export' })
  })

  it('exports the Overview with an audit event', async () => {
    await market()
    const admin = await owner()
    const csv = await get(admin, '/admin/overview/export').buffer(true)
    const text = csv.text ?? csv.body.toString()
    assert.ok(text.startsWith('﻿Metric,All time'))
    assert.ok(text.includes('Average role match,65%'))
    assert.equal(await AuditEvent.countDocuments({ type: 'reports.overview_exported' }), 1)
  })
})
