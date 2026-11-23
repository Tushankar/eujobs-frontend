import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { AgencyAgreement, AgencyClient, AgencyMembership, AgencyPlacement } from '../modules/agencies/agencies.model.js'
import { addDays, today } from '../modules/agencies/lock.js'
import { sendPlacementReminders } from '../modules/agencies/placements.service.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { textPdf } from './helpers/fixtures.js'
import { api, attach, auth, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedAgency, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'

/* 2026-11-20 (agencies, phase 5): what the candidate sees and hears: job cards, the counter, notifications, reminders. */

useTestDb([EmailLog, User, Company, PipelineStage, File, AgencyClient, AgencyAgreement, AgencyMembership, AgencyPlacement, Job, CandidateProfile, Subscription, Application, Notification])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const day = (offset) => addDays(today(), offset)
const NONE = { value: null, clause: null }
const RULES = { exclusivity: NONE, noticeDays: NONE, coolingOffDays: NONE, maxWeeklyHours: NONE }

/** An approved agency (named `name`) with a published agreement version 1. */
async function agency(name) {
  const { user, company } = await approvedAgency()
  if (name) await Company.updateOne({ _id: company._id }, { displayName: name })
  await publishVersion(user)
  return { user, company: await Company.findById(company._id) }
}

async function publishVersion(user, lines = ['Agency Terms', 'Notice of seven days ends an Assignment early.']) {
  await attach(api().post(`${v1}/agency/agreement`).set(auth(user)), await textPdf(lines), 'terms.pdf', 'application/pdf')
  await api().put(`${v1}/agency/agreement/draft/rules`).set(auth(user)).send(RULES)
  assert.equal((await api().post(`${v1}/agency/agreement/draft/publish`).set(auth(user))).status, 200)
}

const client = async (owner, name) => (await api().post(`${v1}/agency/clients`).set(auth(owner)).send({ name })).body

async function agencyJob(owner, clientId, { start = 1, end = 30, title = 'Warehouse picker' } = {}) {
  const created = await api()
    .post(`${v1}/recruiter/jobs`)
    .set(auth(owner))
    .send(jobBody({ title, agency: { clientId, showClient: true, startDate: day(start), endDate: day(end), rate: { amountMinor: 1500, period: 'hour' } } }))
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal((await api().patch(`${v1}/recruiter/jobs/${created.body.id}/status`).set(auth(owner)).send({ status: 'published' })).status, 200)
  return created.body
}

const types = async (user) => (await api().get(`${v1}/notifications`).set(auth(user))).body.items.map((item) => item.type)
const summaries = (user) => mailTo(user.email, 'agency_update').map((mail) => mail.params.summary)
const counters = async (user) => (await api().get(`${v1}/me/counters`).set(auth(user))).body
const longDay = (offset) => new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day(offset)}T00:00:00Z`))

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

describe('the books, from the candidate side', () => {
  it('tells the candidate about invitations, answers, removal and a new agreement version, and counts what waits', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const candidate = await listedCandidate()

    // Invited: the bell, the email and the Agencies counter (an agreement to agree to).
    const invited = (await api().post(`${v1}/agency/talent/invite`).set(auth(owner)).send({ candidateId: String(candidate._id) })).body
    const bell = (await api().get(`${v1}/notifications`).set(auth(candidate))).body.items
    assert.deepEqual([bell[0].type, bell[0].path], ['agency_invited', '/candidate/agencies?tab=agencies'])
    assert.equal((await counters(candidate)).agencyActions, 1)
    assert.equal((await counters(candidate)).notifications.sections.agencies, 1)

    // The agency takes the invitation back; the candidate asks, is declined, asks again and is accepted.
    await api().post(`${v1}/agency/talent/${invited.id}/decline`).set(auth(owner))
    await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))
    await api().post(`${v1}/agency/talent/${invited.id}/decline`).set(auth(owner))
    await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))
    await api().post(`${v1}/agency/talent/${invited.id}/accept`).set(auth(owner))
    await api().post(`${v1}/candidate/agencies/memberships/${invited.id}/agree`).set(auth(candidate)).send({ version: 1 })
    assert.equal((await counters(candidate)).agencyActions, 0)

    // A new version waits for them; then the agency ends the membership.
    await publishVersion(owner, ['Agency Terms', 'Version two.'])
    assert.equal((await counters(candidate)).agencyActions, 1)
    await api().post(`${v1}/agency/talent/${invited.id}/end`).set(auth(owner))
    assert.equal((await counters(candidate)).agencyActions, 0)

    assert.deepEqual(summaries(candidate), [
      'Brightstaff invited you to join its books. Read its agreement to accept.',
      'Brightstaff withdrew its invitation to join its books.',
      'Brightstaff declined your request to join its books.',
      'Brightstaff accepted your request to join its books. Read and agree to its agreement to finish joining.',
      'Brightstaff published version 2 of its agreement. Agree to it before your next placement with them.',
      'Brightstaff took you off its books. A placement already running continues to its end.',
    ])
    assert.deepEqual((await types(candidate)).sort(), ['agency_agreement_updated', 'agency_invited', 'agency_membership_declined', 'agency_membership_declined', 'agency_removed', 'agency_request_accepted'])
  })

  it('keeps the bell but sends no email when the candidate switches agency updates off', async () => {
    const { user: owner } = await agency()
    const candidate = await listedCandidate()
    assert.equal((await api().patch(`${v1}/me/notifications`).set(auth(candidate)).send({ emailSwitches: { agency_updates: false } })).status, 200)
    await api().post(`${v1}/agency/talent/invite`).set(auth(owner)).send({ candidateId: String(candidate._id) })
    assert.deepEqual([await types(candidate), summaries(candidate)], [['agency_invited'], []])
  })
})

describe('placements, from the candidate side', () => {
  it('tells the candidate about a confirmed placement, an earlier end and re-hire offers, with the rules an offer would bring', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const acme = await client(owner, 'Acme')
    const candidate = await listedCandidate()
    const joined = (await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))).body
    await api().post(`${v1}/agency/talent/${joined.id}/accept`).set(auth(owner))
    await api().post(`${v1}/candidate/agencies/memberships/${joined.id}/agree`).set(auth(candidate)).send({ version: 1 })

    // Hired on an agency job.
    const job = await agencyJob(owner, acme.id, { start: 2, end: 20 })
    const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
    const now = new Date()
    const application = await Application.create({ candidateId: candidate._id, jobId: job.id, companyId: company._id, stageId: stage._id, status: 'applied', consentAt: now, appliedAt: now, history: [{ status: 'applied', at: now, actorType: 'candidate' }] })
    const hired = await PipelineStage.findOne({ companyId: company._id, category: 'hired' })
    assert.equal((await api().patch(`${v1}/recruiter/applications/${application._id}/stage`).set(auth(owner)).send({ stageId: String(hired._id) })).status, 200)
    const placement = await AgencyPlacement.findOne({ applicationId: application._id })
    await api().post(`${v1}/agency/placements/${placement._id}/end`).set(auth(owner)).send({ endDate: day(10) })

    // Over: a re-hire offer, shown with the rules accepting it would bring, then withdrawn.
    const over = await placementFor(candidate, company, { start: -30, end: -2 })
    const next = await agencyJob(owner, acme.id, { start: 40, end: 50, title: 'Forklift driver' })
    const offer = (await api().post(`${v1}/agency/placements/${over._id}/rehire`).set(auth(owner)).send({ jobId: next.id })).body
    assert.equal((await counters(candidate)).agencyActions, 1)
    const offers = (await api().get(`${v1}/candidate/placements`).query({ view: 'offered' }).set(auth(candidate))).body.items
    assert.deepEqual([offers[0].id, offers[0].rules.exclusivity.value, offers[0].sources.exclusivity], [offer.id, 'no_other_agency_work', 'default'])
    // A confidential client stays hidden on the offer.
    await Job.updateOne({ _id: next.id }, { 'agency.showClient': false })
    assert.equal((await api().get(`${v1}/candidate/placements`).query({ view: 'offered' }).set(auth(candidate))).body.items[0].client, null)
    assert.equal(await AgencyPlacement.exists({ _id: offer.id, rules: { $exists: true } }), null)
    await api().post(`${v1}/agency/placements/${offer.id}/withdraw`).set(auth(owner))

    assert.deepEqual(summaries(candidate).slice(-4), [
      `Your placement as Warehouse picker with Brightstaff is confirmed. It starts on ${longDay(2)}.`,
      `Brightstaff ended your placement as Warehouse picker early. Your last day is ${longDay(10)}.`,
      'Brightstaff offered you a new placement as Forklift driver. Accept or decline it on your Agencies page.',
      'Brightstaff withdrew its offer for Forklift driver.',
    ])
    const bell = (await api().get(`${v1}/notifications`).set(auth(candidate))).body.items
    assert.deepEqual(bell.find((item) => item.type === 'placement_offered').path, '/candidate/agencies?tab=offers')
    assert.deepEqual(bell.find((item) => item.type === 'placement_confirmed').params.date, day(2))
  })

  it('reminds the candidate the day before a start and three days before the end, once each', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const job = await agencyJob(owner, (await client(owner, 'Acme')).id, { title: 'Picker' })
    const candidate = await listedCandidate()
    const starting = await placementFor(candidate, company, { start: 1, end: 30, jobId: job.id })
    const ending = await placementFor(candidate, company, { start: -10, end: 3, jobId: job.id })
    await placementFor(candidate, company, { start: 5, end: 9 })

    await sendPlacementReminders()
    await sendPlacementReminders()
    assert.deepEqual((await types(candidate)).sort(), ['placement_ends_soon', 'placement_starts_soon'])
    assert.deepEqual(summaries(candidate).sort(), [`Your placement as Picker with Brightstaff ends on ${longDay(3)}.`, `Your placement as Picker with Brightstaff starts tomorrow, ${longDay(1)}.`])
    assert.deepEqual([(await AgencyPlacement.findById(starting._id)).remindedStartOn, (await AgencyPlacement.findById(ending._id)).remindedEndOn], [day(1), day(3)])

    // A notice that moves the end to 3 days from now is reminded too.
    const noticed = await placementFor(candidate, company, { start: -5, end: 40, noticeGivenOn: day(-4), rules: { exclusivity: { value: 'free' }, noticeDays: { value: 7 }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null } } })
    await sendPlacementReminders()
    assert.equal((await AgencyPlacement.findById(noticed._id)).remindedEndOn, day(3))
  })
})

describe('job cards', () => {
  it('show the client, the candidate\'s membership with the agency and the day their placements free them', async () => {
    const { user: owner, company } = await agency('Brightstaff')
    const { user: other } = await agency('Otherstaff')
    const candidate = await listedCandidate()
    await placementFor(candidate, company, { start: -1, end: 15 })
    const overlapping = await agencyJob(other, (await client(other, 'Globex')).id, { start: 10, end: 20 })
    const after = await agencyJob(other, (await client(other, 'Initech')).id, { start: 16, end: 20 })
    await api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))
    const own = await agencyJob(owner, (await client(owner, 'Acme')).id, { start: 30, end: 40 })

    const cards = new Map((await api().get(`${v1}/jobs`).query({ employmentType: 'agency' }).set(auth(candidate))).body.items.map((item) => [item.id, item]))
    assert.deepEqual(cards.get(overlapping.id).lock, { freeFrom: day(16) })
    assert.deepEqual([cards.get(overlapping.id).agency.client, cards.get(overlapping.id).agencyMembership], [{ name: 'Globex' }, null])
    assert.equal(cards.get(after.id).lock, null)
    assert.deepEqual([cards.get(own.id).lock, cards.get(own.id).agencyMembership.status], [null, 'requested'])
    // The job page has the same.
    assert.deepEqual((await api().get(`${v1}/jobs/${overlapping.id}`).set(auth(candidate))).body.lock, { freeFrom: day(16) })
  })
})
