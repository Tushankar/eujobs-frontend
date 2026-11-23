import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { clearUsageCache } from '../lib/usage.js'
import { AgencyAgreement, AgencyClient, AgencyMembership, AgencyPlacement } from '../modules/agencies/agencies.model.js'
import { addDays, today } from '../modules/agencies/lock.js'
import { sendPlacementReminders } from '../modules/agencies/placements.service.js'
import { AiCache, AiUsage, ApiUsage } from '../modules/ai/ai.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { MatchResult } from '../modules/matching/matching.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { textPdf } from './helpers/fixtures.js'
import { api, attach, auth, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedAgency, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

/*
 * 2026-11-23 (agencies, phase 6): AI for agencies — the books ranked per job (with AI reasons and a direct offer), the
 * ending-soon alert with what fits next, agency jobs in For you, the agency job post writer, and chats with the books.
 */
useTestDb([
  User, Company, PipelineStage, File, AgencyClient, AgencyAgreement, AgencyMembership, AgencyPlacement, Job, CandidateProfile, Subscription, Application,
  Notification, MatchResult, AiCache, AiUsage, ApiUsage, Conversation, Message,
])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())
beforeEach(() => {
  aiStub.reset()
  clearUsageCache()
})
after(() => aiStub.reset())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
const day = (offset) => addDays(today(), offset)
const NONE = { value: null, clause: null }
const RULES = { exclusivity: NONE, noticeDays: NONE, coolingOffDays: NONE, maxWeeklyHours: NONE }
const requests = (name) => aiStub.calls.filter((call) => call.kind === 'response' && call.text?.format?.name === name)

/** An approved agency (named `name`, Agency Plus unless `plus: false`) with a published agreement version 1. */
async function agency(name, { plus = true } = {}) {
  const { user, company } = await approvedAgency({ plus })
  await Company.updateOne({ _id: company._id }, { displayName: name })
  await attach(api().post(`${v1}/agency/agreement`).set(auth(user)), await textPdf(['Agency Terms', 'Notice of seven days ends an Assignment early.']), 'terms.pdf', 'application/pdf')
  await api().put(`${v1}/agency/agreement/draft/rules`).set(auth(user)).send(RULES)
  assert.equal((await api().post(`${v1}/agency/agreement/draft/publish`).set(auth(user))).status, 200)
  return { user, company: await Company.findById(company._id) }
}

const client = async (owner, name) => (await api().post(`${v1}/agency/clients`).set(auth(owner)).send({ name })).body

async function agencyJob(owner, clientId, { start = 1, end = 30, title = 'Warehouse picker', publish = true, ...fields } = {}) {
  const created = await api()
    .post(`${v1}/recruiter/jobs`)
    .set(auth(owner))
    .send(jobBody({ title, ...fields, agency: { clientId, showClient: true, startDate: day(start), endDate: day(end), rate: { amountMinor: 1500, period: 'hour' } } }))
  assert.equal(created.status, 201, JSON.stringify(created.body))
  if (publish) assert.equal((await api().patch(`${v1}/recruiter/jobs/${created.body.id}/status`).set(auth(owner)).send({ status: 'published' })).status, 200)
  return created.body
}

/** The candidate joins `company`'s books and agrees to version 1. */
async function onBooks(candidate, company) {
  const joined = (await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))).body
  await api().post(`${v1}/agency/talent/${joined.id}/accept`).set(auth(await User.findOne({ companyId: company._id })))
  assert.equal((await api().post(`${v1}/candidate/agencies/memberships/${joined.id}/agree`).set(auth(candidate)).send({ version: 1 })).body.status, 'active')
  return joined.id
}

/** A confirmed placement written directly: dates as day offsets. */
const placementFor = (candidate, company, { start, end, ...fields }) =>
  AgencyPlacement.create({
    companyId: company._id,
    candidateId: candidate._id,
    jobId: fields.jobId ?? new mongoose.Types.ObjectId(),
    status: 'confirmed',
    startDate: day(start),
    endDate: day(end),
    hoursPerWeek: 40,
    rules: { exclusivity: { value: 'no_other_agency_work' }, noticeDays: { value: null }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null } },
    sources: { exclusivity: 'default' },
    confirmedAt: new Date(),
    ...fields,
  })

const score = (candidate, job, value) => MatchResult.create({ candidateId: candidate._id, jobId: job.id, policyVersionId: new mongoose.Types.ObjectId(), score: value, label: value >= 80 ? 'strong' : value >= 60 ? 'good' : null, sim: 0.5, skillShare: 1, matchedSkills: [], missingSkills: [] })
// The ending-soon emails of an agency (joining the books sends it other updates too).
const endingMails = (owner) => mailTo(owner.email, 'agency_update').map((mail) => mail.params.summary).filter((summary) => summary.includes('placement as'))
const ranking = async (owner, jobId) => (await api().get(`${v1}/agency/talent/ranking`).query({ jobId }).set(auth(owner))).body

describe('the books ranked for a job', () => {
  it('orders by match score, leaves out people a placement blocks, and keeps offered people with their state', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const job = await agencyJob(owner, (await client(owner, 'Acme')).id, { start: 5, end: 20 })
    const [ada, ben, cleo, dev] = await Promise.all(['Ada Low', 'Ben High', 'Cleo Busy', 'Dev Skills'].map((fullName) => listedCandidate({ fullName })))
    for (const person of [ada, ben, cleo, dev]) await onBooks(person, company)
    await score(ada, job, 62)
    await score(ben, job, 91)
    // Cleo's placement runs through the job's dates (the default blocks any agency job); Dev has no score, only skills.
    await placementFor(cleo, company, { start: -3, end: 10 })
    // Someone who only asked to join is not on the books yet.
    await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(await listedCandidate({ fullName: 'Eve Pending' })))

    let body = await ranking(owner, job.id)
    assert.deepEqual(body.items.map((item) => item.candidate.name), ['Ben High', 'Ada Low', 'Dev Skills'])
    assert.equal(body.hidden, 1)
    assert.deepEqual(body.items[0].match, { score: 91, label: 'strong' })
    assert.deepEqual([body.items[2].match, body.items[2].overlap.count], [null, 2])
    assert.deepEqual(body.items.map((item) => [item.state, item.needsAgreement]), [['free', false], ['free', false], ['free', false]])
    assert.deepEqual(body.job, { id: job.id, title: 'Warehouse picker', status: 'published', startDate: day(5), endDate: day(20) })

    // A direct offer: the person stays listed as offered; asking twice is a conflict.
    const offered = await api().post(`${v1}/agency/placements/offer`).set(auth(owner)).send({ jobId: job.id, candidateId: String(ben._id) })
    assert.equal(offered.status, 201, JSON.stringify(offered.body))
    assert.deepEqual([offered.body.status, offered.body.startDate, offered.body.previousId], ['offered', day(5), null])
    assert.deepEqual((await api().post(`${v1}/agency/placements/offer`).set(auth(owner)).send({ jobId: job.id, candidateId: String(ben._id) })).body.error.params, { reason: 'already_placed' })
    body = await ranking(owner, job.id)
    assert.equal(body.items.find((item) => item.candidate.name === 'Ben High').state, 'offered')
    // The candidate accepts like a re-hire offer.
    const accepted = await api().post(`${v1}/candidate/placements/${offered.body.id}/accept`).set(auth(ben))
    assert.equal(accepted.body.status, 'confirmed')
    assert.equal((await ranking(owner, job.id)).items.find((item) => item.candidate.name === 'Ben High').state, 'placed')
  })

  it('offers only published agency jobs of the agency to people on its books, and passes the rule check', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const { user: other } = await agency('Otherstaff')
    const acme = await client(owner, 'Acme')
    const draft = await agencyJob(owner, acme.id, { publish: false })
    const job = await agencyJob(owner, acme.id, { start: 5, end: 20 })
    const othersJob = await agencyJob(other, (await client(other, 'Globex')).id)
    const stranger = await listedCandidate()
    const offer = (body) => api().post(`${v1}/agency/placements/offer`).set(auth(owner)).send(body)

    assert.deepEqual((await offer({ jobId: job.id, candidateId: String(stranger._id) })).body.error.params, { reason: 'not_on_books' })
    await onBooks(stranger, company)
    assert.equal((await offer({ jobId: draft.id, candidateId: String(stranger._id) })).body.error.fields.jobId, 'invalid')
    assert.equal((await offer({ jobId: othersJob.id, candidateId: String(stranger._id) })).body.error.fields.jobId, 'invalid')
    await placementFor(stranger, company, { start: 0, end: 10 })
    const locked = await offer({ jobId: job.id, candidateId: String(stranger._id) })
    assert.equal(code(locked), 'PLACEMENT_LOCKED')
    assert.equal(locked.body.error.params.freeFrom, day(11))
    // The ranking of a job the agency does not own is not found.
    assert.equal((await api().get(`${v1}/agency/talent/ranking`).query({ jobId: othersJob.id }).set(auth(owner))).status, 404)
  })

  it('writes AI reasons from evidence without names, for Agency Plus, cached until the evidence changes', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const job = await agencyJob(owner, (await client(owner, 'Acme')).id, { start: 5, end: 20 })
    const ada = await listedCandidate({ fullName: 'Ada Lovelace' })
    const membershipId = await onBooks(ada, company)
    await score(ada, job, 77)
    aiStub.reply = (request) => (request.text.format.name === 'talent_ranking' ? { items: [{ membershipId, reason: '  Both required skills and five years.  ' }, { membershipId: 'made-up', reason: 'x' }, { membershipId, reason: 'again' }] } : null)

    const reasons = await api().post(`${v1}/agency/talent/ranking/reasons`).set(auth(owner)).send({ jobId: job.id })
    assert.equal(reasons.status, 200, JSON.stringify(reasons.body))
    assert.deepEqual(reasons.body.items, [{ membershipId, reason: 'Both required skills and five years.' }])
    const input = requests('talent_ranking')[0].input
    assert.ok(!input.includes('Ada') && !input.includes('Lovelace'), 'no names reach OpenAI')
    assert.ok(input.includes('"matchScore":77'))
    await api().post(`${v1}/agency/talent/ranking/reasons`).set(auth(owner)).send({ jobId: job.id })
    assert.equal(requests('talent_ranking').length, 1, 'cached while nothing changed')
    assert.equal((await AiUsage.findOne({ userId: owner._id })).count, 1)

    // Agency Free sees the ranking but not the AI reasons.
    const { user: free, company: freeCompany } = await agency('Freestaff', { plus: false })
    const freeJob = await agencyJob(free, (await client(free, 'Initech')).id)
    await onBooks(await listedCandidate(), freeCompany)
    assert.equal((await ranking(free, freeJob.id)).items.length, 1)
    assert.equal((await api().post(`${v1}/agency/talent/ranking/reasons`).set(auth(free)).send({ jobId: freeJob.id })).status, 402)
  })
})

describe('ending soon: what fits next', () => {
  it('alerts the agency 7 days before the effective end with its next fitting jobs, once, and shows them on the card', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const acme = await client(owner, 'Acme')
    const current = await agencyJob(owner, acme.id, { start: 0, end: 30, title: 'Picker' })
    const ada = await listedCandidate({ fullName: 'Ada Low' })
    await onBooks(ada, company)
    // Booked to day 40, but the agency ended it early on day 7: the alert follows the effective end.
    const ending = await placementFor(ada, company, { start: -10, end: 40, endedEarlyOn: day(7), jobId: current.id })
    // Starts before Ada is free, so it never fits next.
    await agencyJob(owner, acme.id, { start: 6, end: 12, title: 'Clashing shift' })
    const better = await agencyJob(owner, acme.id, { start: 8, end: 20, title: 'Forklift driver' })
    const later = await agencyJob(owner, acme.id, { start: 15, end: 25, title: 'Packer' })
    await score(ada, later, 70)
    await score(ada, better, 88)

    await sendPlacementReminders()
    await sendPlacementReminders()
    const bell = (await api().get(`${v1}/notifications`).set(auth(owner))).body.items.filter((item) => item.type === 'placement_ending_soon')
    assert.equal(bell.length, 1)
    assert.deepEqual([bell[0].path, bell[0].params.next, bell[0].params.jobs, bell[0].params.date], ['/agency/placements', 2, ['Forklift driver', 'Packer'], day(7)])
    const longDay = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day(7)}T00:00:00Z`))
    assert.deepEqual(endingMails(owner), [
      `Ada Low's placement as Picker ends on ${longDay}. Your open jobs that fit them next: Forklift driver and Packer. Offer one from Placements.`,
    ])
    assert.equal((await AgencyPlacement.findById(ending._id)).remindedAgencyEndOn, day(7))

    // Placements › Running: the card lists the same jobs; an offer takes that job out.
    let card = (await api().get(`${v1}/agency/placements`).set(auth(owner))).body.items.find((item) => item.id === String(ending._id))
    assert.deepEqual(card.next.map((job) => [job.title, job.match?.score ?? null]), [['Forklift driver', 88], ['Packer', 70]])
    assert.equal((await api().post(`${v1}/agency/placements/offer`).set(auth(owner)).send({ jobId: better.id, candidateId: String(ada._id) })).status, 201)
    card = (await api().get(`${v1}/agency/placements`).set(auth(owner))).body.items.find((item) => item.id === String(ending._id))
    assert.deepEqual(card.next.map((job) => job.title), ['Packer'])
  })

  it('says when nothing fits yet, and placements ending later have no next list', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const job = await agencyJob(owner, (await client(owner, 'Acme')).id, { start: 0, end: 7, title: 'Picker' })
    const ada = await listedCandidate({ fullName: 'Ada Low' })
    await onBooks(ada, company)
    await placementFor(ada, company, { start: -2, end: 7, jobId: job.id })
    const far = await placementFor(await listedCandidate(), company, { start: -2, end: 20, jobId: job.id })
    await sendPlacementReminders()
    assert.match(endingMails(owner)[0], /None of your published agency jobs starting after that fits them yet\.$/)
    const items = (await api().get(`${v1}/agency/placements`).set(auth(owner))).body.items
    assert.equal(items.find((item) => item.id === String(far._id)).next, undefined)
  })
})

describe('For you', () => {
  it('leaves out agency jobs the candidate is blocked from and lifts jobs of their own agencies', async () => {
    const { user: mine, company: mineCompany } = await agency('Mystaff')
    const { user: other, company: otherCompany } = await agency('Otherstaff')
    const candidate = await listedCandidate()
    // Created first, so without the lift the newer job of the other agency would come first.
    const own = await agencyJob(mine, (await client(mine, 'Acme')).id, { start: 40, end: 50, title: 'Own agency job' })
    const others = await agencyJob(other, (await client(other, 'Globex')).id, { start: 40, end: 50, title: 'Other agency job' })
    const blocked = await agencyJob(other, (await client(other, 'Initech')).id, { start: 2, end: 9, title: 'Blocked job' })
    await onBooks(candidate, mineCompany)
    await placementFor(candidate, otherCompany, { start: 0, end: 10 })

    const forYou = (await api().get(`${v1}/jobs/recommended`).set(auth(candidate))).body
    const titles = forYou.items.map((item) => item.title)
    assert.ok(!titles.includes('Blocked job'))
    assert.ok(titles.indexOf('Own agency job') < titles.indexOf('Other agency job'), titles.join(', '))
    assert.equal((await api().get(`${v1}/candidate/overview`).set(auth(candidate))).body.recommended.count, forYou.total)
    // Find jobs still lists the blocked job with its free-from day.
    const all = (await api().get(`${v1}/jobs`).query({ employmentType: 'agency' }).set(auth(candidate))).body.items
    assert.deepEqual(all.find((item) => item.id === blocked.id).lock, { freeFrom: day(11) })
    assert.deepEqual([own.title, others.title], ['Own agency job', 'Other agency job'])
  })
})

describe('chats with the books', () => {
  it('lets an agency on any plan start a chat with someone on its books, and no one else without Agency Plus', async () => {
    const { user: owner, company } = await agency('Freestaff', { plus: false })
    // Not discoverable and never applied: reachable only through the books.
    const member = await listedCandidate({ privacy: { discoverable: false, matchingConsent: true } })
    const stranger = await listedCandidate()
    const start = (candidate) => api().post(`${v1}/conversations`).set(auth(owner)).send({ candidateId: String(candidate._id), body: 'Hello, a shift came up.' })

    assert.equal((await start(member)).status, 402)
    await onBooks(member, company)
    const started = await start(member)
    assert.equal(started.status, 201, JSON.stringify(started.body))
    assert.equal((await start(stranger)).status, 402)
    const profile = (await api().get(`${v1}/recruiter/candidates/${member._id}`).set(auth(owner))).body
    assert.deepEqual([profile.onBooks, profile.canStartConversation], [true, true])
  })
})

describe('agency job post writer', () => {
  it('fills the client from the agency\'s own list, valid dates, the rate and hours, and keeps the client out of the text', async () => {
    const { user: owner } = await agency('Brightstaff')
    const acme = await client(owner, 'Acme Logistics Ltd')
    await client(owner, 'Globex')
    let reply = {}
    aiStub.reply = (request) =>
      request.text.format.name === 'job_draft'
        ? {
            brief: 'You will cover the Acme Logistics Ltd night shift. acme logistics ltd values care.',
            responsibilities: ['Pick orders for Acme Logistics Ltd', 'Load vans'],
            requiredSkills: ['Forklift licence'],
            preferredSkills: [],
            level: 'junior',
            experienceYears: 1,
            languages: [],
            clientRef: 'c1',
            clientName: 'Acme Logistics Ltd',
            startDate: day(3),
            endDate: day(24),
            rate: 14.5,
            ratePeriod: 'hour',
            hoursPerWeek: 38,
            ...reply,
          }
        : null
    const draft = (notes) => api().post(`${v1}/recruiter/ai/job-draft`).set(auth(owner)).send({ title: 'Warehouse operative', employmentType: 'full_time', notes })

    let res = await draft('3 weeks night cover for Acme from Thursday, 14.50 an hour, 38 hours')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.agency, { clientId: acme.id, unknownClient: null, startDate: day(3), endDate: day(24), rate: { amount: 14.5, period: 'hour' }, hoursPerWeek: 38 })
    assert.equal(res.body.brief, 'You will cover the the client night shift. the client values care.')
    assert.deepEqual(res.body.responsibilities, ['Pick orders for the client', 'Load vans'])
    const input = requests('job_draft')[0].input
    assert.match(input, /"clients":\[\{"ref":"c1","name":"Acme Logistics Ltd"\},\{"ref":"c2","name":"Globex"\}\]/)
    assert.match(input, new RegExp(`"today":"${today()}"`))

    // A client not on the list, dates in the past or reversed, a rate and hours out of range: left out.
    reply = { clientRef: 'c9', clientName: 'Initech', startDate: day(-2), endDate: day(10), rate: 0, ratePeriod: 'none', hoursPerWeek: 200 }
    res = await draft('cover for Initech')
    assert.deepEqual(res.body.agency, { clientId: null, unknownClient: 'Initech', startDate: null, endDate: null, rate: null, hoursPerWeek: null })
    reply = { clientRef: '', clientName: 'globex', startDate: day(5), endDate: day(4) }
    res = await draft('cover for globex')
    assert.deepEqual([res.body.agency.clientId, res.body.agency.startDate, res.body.agency.endDate], [String((await AgencyClient.findOne({ name: 'Globex' }))._id), day(5), null])
  })
})
