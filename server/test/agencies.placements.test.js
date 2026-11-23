import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { AgencyAgreement, AgencyClient, AgencyMembership, AgencyPlacement } from '../modules/agencies/agencies.model.js'
import { addDays, today } from '../modules/agencies/lock.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { textPdf } from './helpers/fixtures.js'
import { api, attach, auth, useTestDb, useTestUploads } from './helpers/index.js'
import { applicantCandidate, approvedAgency, approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'

/* 2026-11-20 (agencies, phase 3): placements and the rule check that decides whether a candidate may take a job. */

useTestDb([EmailLog, User, Company, PipelineStage, File, AgencyClient, AgencyAgreement, AgencyMembership, AgencyPlacement, Job, CandidateProfile, CvVersion, VerificationSubmission, Subscription, Application])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
const day = (offset) => addDays(today(), offset)
const NONE = { value: null, clause: null }
const AGREEMENT = ['Agency Terms', 'The Worker shall do no other paid work while an Assignment is in progress.', 'Notice of seven days ends an Assignment early.']
const agreementRules = (overrides = {}) => ({ exclusivity: NONE, noticeDays: NONE, coolingOffDays: NONE, maxWeeklyHours: NONE, ...overrides })

/** An approved agency (Agency Plus) with a published agreement whose rules are `rules`. */
async function agency(rules = agreementRules(), options) {
  const { user, company } = await approvedAgency(options)
  await attach(api().post(`${v1}/agency/agreement`).set(auth(user)), await textPdf(AGREEMENT), 'terms.pdf', 'application/pdf')
  await api().put(`${v1}/agency/agreement/draft/rules`).set(auth(user)).send(rules)
  assert.equal((await api().post(`${v1}/agency/agreement/draft/publish`).set(auth(user))).status, 200)
  return { user, company }
}

const client = async (owner, body) => (await api().post(`${v1}/agency/clients`).set(auth(owner)).send(body)).body

/** A published agency job of `owner` for `clientId`, from `start` to `end` days from today. */
async function agencyJob(owner, clientId, { start = 1, end = 30, hoursPerWeek = null, employmentType = 'full_time' } = {}) {
  const created = await api()
    .post(`${v1}/recruiter/jobs`)
    .set(auth(owner))
    .send(jobBody({ employmentType, agency: { clientId, startDate: day(start), endDate: day(end), rate: { amountMinor: 1500, period: 'hour' }, hoursPerWeek } }))
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal((await api().patch(`${v1}/recruiter/jobs/${created.body.id}/status`).set(auth(owner)).send({ status: 'published' })).status, 200)
  return created.body
}

/** The candidate joins `company`'s books and agrees to its current agreement. */
async function onBooks(candidate, company) {
  const joined = (await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))).body
  await api().post(`${v1}/agency/talent/${joined.id}/accept`).set(auth(await User.findOne({ companyId: company._id })))
  const version = (await AgencyAgreement.findOne({ companyId: company._id, status: 'published' }).sort({ version: -1 })).version
  assert.equal((await api().post(`${v1}/candidate/agencies/memberships/${joined.id}/agree`).set(auth(candidate)).send({ version })).body.status, 'active')
  return joined.id
}

/** An application record of `candidate` to `job` (the apply flow is tested on its own). */
async function applicationTo(candidate, job) {
  const stage = await PipelineStage.findOne({ companyId: job.company.id, isEntry: true })
  const now = new Date()
  return Application.create({ candidateId: candidate._id, jobId: job.id, companyId: job.company.id, stageId: stage._id, status: 'applied', consentAt: now, appliedAt: now, history: [{ status: 'applied', at: now, actorType: 'candidate' }] })
}

const stage = (companyId, category) => PipelineStage.findOne({ companyId, category })
const move = async (owner, application, category) => api().patch(`${v1}/recruiter/applications/${application._id}/stage`).set(auth(owner)).send({ stageId: String((await stage(application.companyId, category))._id) })
const check = async (candidate, jobId) => (await api().get(`${v1}/candidate/placements/check`).query({ jobId }).set(auth(candidate))).body

/** A confirmed placement written directly (for the rule check alone): dates as day offsets, rules with their sources. */
function placementFor(candidate, company, { start, end, rules = {}, sources = {}, hours = 40, clientRow = null, ...fields }) {
  return AgencyPlacement.create({
    companyId: company._id,
    candidateId: candidate._id,
    jobId: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    startDate: day(start),
    endDate: day(end),
    hoursPerWeek: hours,
    client: clientRow ? { clientId: clientRow.id, name: clientRow.name, nameKey: (clientRow.nameKey ?? clientRow.name).toLowerCase(), linkedCompanyId: clientRow.linkedCompany?.id } : undefined,
    rules: { exclusivity: { value: 'no_other_agency_work' }, noticeDays: { value: null }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null }, ...rules },
    sources: { exclusivity: 'default', ...sources },
    confirmedAt: new Date(),
    ...fields,
  })
}

/** A company job of a recruiter (always open: it runs from today). */
async function companyJob(recruiter, overrides = {}) {
  const created = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody(overrides))
  await api().patch(`${v1}/recruiter/jobs/${created.body.id}/status`).set(auth(recruiter)).send({ status: 'published' })
  return created.body
}

describe('hiring makes a placement', () => {
  it('needs the candidate on the books with the current agreement, then copies the rules with their sources', async () => {
    const { user: owner, company } = await agency(agreementRules({ noticeDays: { value: 7, clause: AGREEMENT[2] } }))
    const acme = await client(owner, { name: 'Acme Ltd' })
    const job = await agencyJob(owner, acme.id, { start: 5, end: 35 })
    // The job's contract says the exclusivity and the cooling-off.
    const terms = ['Assignment terms', 'The Worker may not take work through any other agency during this Assignment.', 'No work for the client through others for 60 days after it ends.']
    await attach(api().post(`${v1}/recruiter/jobs/${job.id}/contract`).set(auth(owner)), await textPdf(terms), 'assignment.pdf', 'application/pdf')
    await api().put(`${v1}/recruiter/jobs/${job.id}/contract/rules`).set(auth(owner)).send(agreementRules({ exclusivity: { value: 'no_other_agency_work', clause: terms[1] }, coolingOffDays: { value: 60, clause: terms[2] } }))

    const candidate = await listedCandidate()
    const application = await applicationTo(candidate, job)
    assert.deepEqual((await move(owner, application, 'hired')).body.error.params, { reason: 'not_on_books' })
    const joined = (await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))).body
    await api().post(`${v1}/agency/talent/${joined.id}/accept`).set(auth(owner))
    assert.deepEqual((await move(owner, application, 'hired')).body.error.params, { reason: 'not_on_books' })
    await api().post(`${v1}/candidate/agencies/memberships/${joined.id}/agree`).set(auth(candidate)).send({ version: 1 })

    const hired = await move(owner, application, 'hired')
    assert.deepEqual([hired.status, hired.body.status], [200, 'hired'])
    const [placement] = (await api().get(`${v1}/agency/placements`).set(auth(owner))).body.items
    assert.deepEqual([placement.status, placement.phase, placement.startDate, placement.endDate, placement.client.name, placement.hoursPerWeek], ['confirmed', 'upcoming', day(5), day(35), 'Acme Ltd', 40])
    assert.deepEqual(placement.rules, {
      exclusivity: { value: 'no_other_agency_work', clause: terms[1] },
      noticeDays: { value: 7, clause: AGREEMENT[2] },
      coolingOffDays: { value: 60, clause: terms[2] },
      maxWeeklyHours: NONE,
    })
    assert.deepEqual(placement.sources, { exclusivity: 'contract', noticeDays: 'agreement', coolingOffDays: 'contract', maxWeeklyHours: null })
    assert.deepEqual((await api().get(`${v1}/candidate/placements`).set(auth(candidate))).body.items.map((item) => item.id), [placement.id])

    // Not started yet: leaving Hired cancels it.
    assert.equal((await move(owner, application, 'offer')).status, 200)
    assert.equal((await AgencyPlacement.findById(placement.id)).status, 'cancelled')
  })

  it('keeps a started placement when the stage would change, and asks for a new agreement version first', async () => {
    const { user: owner, company } = await agency()
    const acme = await client(owner, { name: 'Acme' })
    const job = await agencyJob(owner, acme.id, { start: 0, end: 20 })
    const candidate = await listedCandidate()
    await onBooks(candidate, company)
    const application = await applicationTo(candidate, job)
    assert.equal((await move(owner, application, 'hired')).status, 200)
    assert.deepEqual((await move(owner, application, 'offer')).body.error.params, { reason: 'placement_started' })
    assert.deepEqual((await api().post(`${v1}/recruiter/applications/${application._id}/reject`).set(auth(owner)).send({ notify: false })).body.error.params, { reason: 'placement_started' })

    // A new version waits for the candidate: hiring them again needs it agreed.
    const second = await agencyJob(owner, acme.id, { start: 40, end: 50 })
    await attach(api().post(`${v1}/agency/agreement`).set(auth(owner)), await textPdf([...AGREEMENT, 'Version two.']), 'terms.pdf', 'application/pdf')
    await api().post(`${v1}/agency/agreement/draft/publish`).set(auth(owner))
    assert.deepEqual((await move(owner, await applicationTo(candidate, second), 'hired')).body.error.params, { reason: 'agreement_pending' })
  })
})

describe('applications on agency jobs', () => {
  // 2026-11-23 (owner): the agency sees where each applicant stands on its books before it tries Hired.
  it('carry the applicant\'s place on the books, and Hired explains what is missing', async () => {
    const { user: owner, company } = await agency()
    const job = await agencyJob(owner, (await client(owner, { name: 'Acme' })).id)
    const candidate = await listedCandidate()
    await applicationTo(candidate, job)
    const books = async () => (await api().get(`${v1}/recruiter/applications`).set(auth(owner))).body.items[0].books
    assert.deepEqual(await books(), { id: null, status: 'none', agreementPending: false })

    const joined = (await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))).body
    assert.deepEqual(await books(), { id: joined.id, status: 'requested', agreementPending: false })
    const [application] = (await api().get(`${v1}/recruiter/applications`).set(auth(owner))).body.items
    const refused = await move(owner, await Application.findById(application.id), 'hired')
    assert.deepEqual([refused.status, refused.body.error.params.reason], [409, 'not_on_books'])

    await api().post(`${v1}/agency/talent/${joined.id}/accept`).set(auth(owner))
    assert.equal((await books()).status, 'awaiting_agreement')
    await api().post(`${v1}/candidate/agencies/memberships/${joined.id}/agree`).set(auth(candidate)).send({ version: 1 })
    assert.deepEqual(await books(), { id: joined.id, status: 'active', agreementPending: false })
  })
})

describe('the rule check', () => {
  // 2026-11-23 (owner): before applying, the candidate sees the rules a placement on the job would follow, and where they stand.
  it('previews the rules a placement on an agency job would follow and the candidate\'s place on the books', async () => {
    const notice = { value: 7, clause: 'Notice of seven days ends an Assignment early.' }
    const { user: owner, company } = await agency(agreementRules({ noticeDays: notice }))
    const { user: recruiter } = await approvedRecruiter()
    const job = await agencyJob(owner, (await client(owner, { name: 'Acme' })).id)
    const candidate = await listedCandidate()

    const before = await check(candidate, job.id)
    assert.equal(before.allowed, true)
    assert.deepEqual(before.books, { status: 'none', agreementVersion: 1, agreementPending: false })
    assert.deepEqual(before.rules, {
      exclusivity: { value: 'no_other_agency_work', clause: null, source: 'default' },
      noticeDays: { ...notice, source: 'agreement' },
      coolingOffDays: { value: null, clause: null, source: null },
      maxWeeklyHours: { value: null, clause: null, source: null },
    })
    await onBooks(candidate, company)
    assert.deepEqual((await check(candidate, job.id)).books, { status: 'active', agreementVersion: 1, agreementPending: false })
    // A company job has no agency rules to preview.
    assert.equal((await check(candidate, (await companyJob(recruiter)).id)).rules, undefined)
  })

  it('by default blocks other agency jobs whose dates overlap, never company jobs', async () => {
    const { company: first } = await agency()
    const { user: other } = await agency()
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await listedCandidate()
    await placementFor(candidate, first, { start: 1, end: 30 })
    const otherClient = await client(other, { name: 'Elsewhere' })
    const overlapping = await agencyJob(other, otherClient.id, { start: 20, end: 40 })
    const after = await agencyJob(other, otherClient.id, { start: 31, end: 40 })
    const result = await check(candidate, overlapping.id)
    assert.deepEqual([result.allowed, result.freeFrom], [false, day(31)])
    assert.deepEqual(result.blocks.map(({ rule, value, source, clause }) => [rule, value, source, clause]), [['exclusivity', 'no_other_agency_work', 'default', null]])
    assert.equal((await check(candidate, after.id)).allowed, true)
    assert.equal((await check(candidate, (await companyJob(recruiter)).id)).allowed, true)
  })

  it('blocks any job while no other work is allowed, and follows notice and an earlier end', async () => {
    const { user: owner, company } = await agency()
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await listedCandidate()
    const placement = await placementFor(candidate, company, { start: -5, end: 60, rules: { exclusivity: { value: 'no_other_work', clause: 'No other work.' }, noticeDays: { value: 7 } }, sources: { exclusivity: 'agreement', noticeDays: 'agreement' } })
    const job = await companyJob(recruiter)
    assert.deepEqual([(await check(candidate, job.id)).freeFrom], [day(61)])

    const notice = await api().post(`${v1}/candidate/placements/${placement._id}/notice`).set(auth(candidate))
    assert.deepEqual([notice.body.noticeGivenOn, notice.body.effectiveEnd, notice.body.phase], [day(0), day(7), 'running'])
    assert.equal((await check(candidate, job.id)).freeFrom, day(8))
    assert.deepEqual((await api().post(`${v1}/candidate/placements/${placement._id}/notice`).set(auth(candidate))).body.error.params, { reason: 'notice_given' })

    const end = (endDate) => api().post(`${v1}/agency/placements/${placement._id}/end`).set(auth(owner)).send({ endDate })
    assert.deepEqual((await end(day(-1))).body.error.fields, { endDate: 'invalid' })
    assert.deepEqual((await end(day(9))).body.error.fields, { endDate: 'invalid' })
    assert.equal((await end(day(2))).body.effectiveEnd, day(2))
    assert.equal((await check(candidate, job.id)).freeFrom, day(3))
  })

  it('keeps a no-same-client placement from that client (linked company or same name), and allows the rest', async () => {
    const { user: owner, company } = await agency()
    const { user: other } = await agency()
    const { user: clientRecruiter, company: clientCompany } = await approvedRecruiter()
    const { user: elsewhere } = await approvedRecruiter()
    const linked = await client(owner, { name: 'Acme Ltd', linkedCompanyId: String(clientCompany._id) })
    const candidate = await listedCandidate()
    await placementFor(candidate, company, { start: -1, end: 20, clientRow: { ...linked, nameKey: 'acme' }, rules: { exclusivity: { value: 'no_same_client' } }, sources: { exclusivity: 'contract' } })
    assert.deepEqual((await check(candidate, (await companyJob(clientRecruiter)).id)).blocks.map((block) => block.rule), ['exclusivity'])
    assert.equal((await check(candidate, (await companyJob(elsewhere)).id)).allowed, true)
    // Another agency's job for a client of the same name.
    const sameName = await client(other, { name: 'ACME' })
    assert.equal((await check(candidate, (await agencyJob(other, sameName.id, { start: 5, end: 10 })).id)).allowed, false)
    const otherName = await client(other, { name: 'Globex' })
    assert.equal((await check(candidate, (await agencyJob(other, otherName.id, { start: 5, end: 10 })).id)).allowed, true)
  })

  it('applies cooling-off at the same client through anyone but the agency itself', async () => {
    const { user: owner, company } = await agency()
    const { user: other } = await agency()
    const acme = await client(owner, { name: 'Acme' })
    const candidate = await listedCandidate()
    await placementFor(candidate, company, { start: -40, end: -10, clientRow: acme, rules: { coolingOffDays: { value: 30 } }, sources: { coolingOffDays: 'contract' } })
    const otherAcme = await client(other, { name: 'Acme' })
    const result = await check(candidate, (await agencyJob(other, otherAcme.id, { start: 1, end: 10 })).id)
    assert.deepEqual([result.blocks.map((block) => block.rule), result.freeFrom], [['coolingOffDays'], day(21)])
    // The agency itself may place them there again; after the cooling-off anyone may.
    assert.equal((await check(candidate, (await agencyJob(owner, acme.id, { start: 1, end: 10 })).id)).allowed, true)
    assert.equal((await check(candidate, (await agencyJob(other, otherAcme.id, { start: 21, end: 30 })).id)).allowed, true)
  })

  it('counts weekly hours across overlapping placements against the maximum', async () => {
    const { company } = await agency()
    const { user: other } = await agency()
    const candidate = await listedCandidate()
    await placementFor(candidate, company, { start: 0, end: 30, hours: 30, rules: { exclusivity: { value: 'free' }, maxWeeklyHours: { value: 40 } }, sources: { exclusivity: 'agreement', maxWeeklyHours: 'agreement' } })
    const globex = await client(other, { name: 'Globex' })
    const partTime = await agencyJob(other, globex.id, { start: 5, end: 10, employmentType: 'part_time' })
    assert.deepEqual((await check(candidate, partTime.id)).blocks.map((block) => [block.rule, block.value]), [['maxWeeklyHours', 40]])
    assert.equal((await check(candidate, (await agencyJob(other, globex.id, { start: 5, end: 10, employmentType: 'part_time', hoursPerWeek: 10 })).id)).allowed, true)
  })

  it('refuses to apply while the rules block the job', async () => {
    const { company } = await agency()
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await applicantCandidate()
    await CandidateProfile.updateOne({ userId: candidate._id }, { location: PLACES.london })
    await placementFor(candidate, company, { start: -1, end: 10, rules: { exclusivity: { value: 'no_other_work', clause: 'No other work.' } }, sources: { exclusivity: 'agreement' } })
    const job = await companyJob(recruiter)
    const res = await api().post(`${v1}/candidate/applications`).set(auth(candidate)).send({ jobId: job.id, consent: true })
    assert.equal(code(res), 'PLACEMENT_LOCKED')
    assert.deepEqual([res.body.error.params.freeFrom, res.body.error.params.blocks[0].clause], [day(11), 'No other work.'])
  })
})

describe('re-hire', () => {
  it('offers another job after a placement is over; the candidate accepts or declines', async () => {
    const { user: owner, company } = await agency()
    const acme = await client(owner, { name: 'Acme' })
    const candidate = await listedCandidate()
    await onBooks(candidate, company)
    const over = await placementFor(candidate, company, { start: -30, end: -1, clientRow: acme })
    const running = await placementFor(candidate, company, { start: -1, end: 5, clientRow: acme })
    const next = await agencyJob(owner, acme.id, { start: 10, end: 20 })
    const offer = (placement) => api().post(`${v1}/agency/placements/${placement._id}/rehire`).set(auth(owner)).send({ jobId: next.id })
    assert.deepEqual((await offer(running)).body.error.params, { reason: 'not_over' })

    const offered = await offer(over)
    assert.deepEqual([offered.status, offered.body.status, offered.body.startDate, offered.body.previousId], [201, 'offered', day(10), String(over._id)])
    assert.deepEqual((await offer(over)).body.error.params, { reason: 'already_placed' })
    const accepted = await api().post(`${v1}/candidate/placements/${offered.body.id}/accept`).set(auth(candidate))
    assert.deepEqual([accepted.body.status, accepted.body.phase, accepted.body.sources.exclusivity], ['confirmed', 'upcoming', 'default'])

    // A second offer: withdrawn by the agency, or declined by the candidate.
    const later = await agencyJob(owner, acme.id, { start: 30, end: 40 })
    const second = await api().post(`${v1}/agency/placements/${over._id}/rehire`).set(auth(owner)).send({ jobId: later.id })
    assert.equal((await api().post(`${v1}/candidate/placements/${second.body.id}/decline`).set(auth(candidate))).body.status, 'declined')
    const third = await api().post(`${v1}/agency/placements/${over._id}/rehire`).set(auth(owner)).send({ jobId: later.id })
    assert.equal((await api().post(`${v1}/agency/placements/${third.body.id}/withdraw`).set(auth(owner))).body.status, 'withdrawn')
    assert.equal((await api().post(`${v1}/candidate/placements/${third.body.id}/accept`).set(auth(candidate))).body.error.params.status, 'withdrawn')
  })
})
