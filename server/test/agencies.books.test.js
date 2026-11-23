import assert from 'node:assert/strict'
import { before, beforeEach, describe, it } from 'node:test'
import { AiCache, AiUsage } from '../modules/ai/ai.model.js'
import { AgencyAgreement, AgencyClient, AgencyMembership } from '../modules/agencies/agencies.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { creditCost } from '../lib/usage.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { imagePdf, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedAgency, approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'

/* 2026-11-20 (agencies, phase 2): the agency agreement and contract rules (AI proposes, the agency confirms) and the books. */

useTestDb([EmailLog, User, Company, PipelineStage, File, AuditEvent, AgencyClient, AgencyAgreement, AgencyMembership, Job, CandidateProfile, Subscription, Application, AiCache, AiUsage])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())
beforeEach(() => aiStub.reset())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
const EXCLUSIVE = 'The Worker shall not accept assignments through any other employment agency while an Assignment is in progress.'
const NOTICE = 'Either party may end an Assignment by giving one week of written notice.'
const AGREEMENT = ['Agency Terms of Engagement', EXCLUSIVE, NOTICE, 'These terms are governed by the laws of England.']
const NONE = { value: null, clause: null }
const RULES = { exclusivity: { value: 'no_other_agency_work', clause: EXCLUSIVE }, noticeDays: { value: 7, clause: NOTICE }, coolingOffDays: NONE, maxWeeklyHours: NONE }

/** AI's answer for a contract: the given rules, everything else not stated. */
const aiAnswers = (rules) => {
  aiStub.reply = (request) => (request.text.format.name === 'contract_rules' ? { exclusivity: NONE, noticeDays: NONE, coolingOffDays: NONE, maxWeeklyHours: NONE, ...rules } : null)
}

const uploadAgreement = async (agency, lines = AGREEMENT) => attach(api().post(`${v1}/agency/agreement`).set(auth(agency)), await textPdf(lines), 'terms.pdf', 'application/pdf')
const draftRules = (agency, rules) => api().put(`${v1}/agency/agreement/draft/rules`).set(auth(agency)).send(rules)
const publish = (agency) => api().post(`${v1}/agency/agreement/draft/publish`).set(auth(agency))

/** An agency with a published agreement version 1 (rules as RULES). */
async function agencyWithAgreement(options) {
  const { user, company } = await approvedAgency(options)
  await uploadAgreement(user)
  await draftRules(user, RULES)
  assert.equal((await publish(user)).status, 200)
  return { user, company }
}

const join = (candidate, company) => api().post(`${v1}/candidate/agencies/${company._id}/join`).set(auth(candidate))
const agree = (candidate, id, version) => api().post(`${v1}/candidate/agencies/memberships/${id}/agree`).set(auth(candidate)).send({ version })
const talent = async (agency, status) => (await api().get(`${v1}/agency/talent`).query(status ? { status } : {}).set(auth(agency))).body
const agencyAction = (agency, id, action) => api().post(`${v1}/agency/talent/${id}/${action}`).set(auth(agency))

describe('the agency agreement', () => {
  it('reads a draft with AI, keeps only clauses that are in the PDF and drops values out of range', async () => {
    const { user: agency } = await approvedAgency()
    const uploaded = await uploadAgreement(agency)
    assert.deepEqual([uploaded.status, uploaded.body.current, uploaded.body.draft.version, uploaded.body.draft.rules.exclusivity], [201, null, 1, NONE])
    aiAnswers({
      exclusivity: RULES.exclusivity,
      // A quote the document does not contain keeps its value without the clause.
      noticeDays: { value: 7, clause: 'Notice is one week.' },
      // 2000 days is above the limit: dropped.
      coolingOffDays: { value: 2000, clause: NOTICE },
    })
    const read = await api().post(`${v1}/agency/agreement/draft/read`).set(auth(agency))
    assert.equal(read.status, 200)
    assert.deepEqual(read.body.draft.rules, { exclusivity: RULES.exclusivity, noticeDays: { value: 7, clause: null }, coolingOffDays: NONE, maxWeeklyHours: NONE })
    assert.deepEqual(read.body.draft.aiRules, read.body.draft.rules)
    assert.equal((await AiUsage.findOne({ userId: agency._id })).count, await creditCost('contract_rules'))
  })

  it('lets Free agencies type the rules, with quoted clauses checked against the PDF', async () => {
    const { user: agency } = await approvedAgency({ plus: false })
    await uploadAgreement(agency)
    assert.equal(code(await api().post(`${v1}/agency/agreement/draft/read`).set(auth(agency))), 'PLAN_REQUIRED')
    const wrong = await draftRules(agency, { ...RULES, noticeDays: { value: 7, clause: 'A clause that is not there.' } })
    assert.deepEqual(wrong.body.error.fields, { 'noticeDays.clause': 'not_in_document' })
    // Spacing, quotes and case may differ from the PDF's text layer.
    const typed = await draftRules(agency, { ...RULES, noticeDays: { value: 7, clause: `  ${NOTICE.toUpperCase()}` } })
    assert.equal(typed.body.draft.rules.noticeDays.value, 7)
    assert.equal(typed.body.draft.aiRules, null)
  })

  it('cannot read a scan, whose rules are typed without clause checks', async () => {
    const { user: agency } = await approvedAgency()
    await attach(api().post(`${v1}/agency/agreement`).set(auth(agency)), await imagePdf(), 'scan.pdf', 'application/pdf')
    assert.deepEqual((await api().post(`${v1}/agency/agreement/draft/read`).set(auth(agency))).body.error.fields, { file: 'no_text' })
    assert.equal((await draftRules(agency, { ...RULES, noticeDays: { value: 14, clause: 'Clause 4: two weeks.' } })).status, 200)
  })

  it('publishes versions: the latest is current, earlier ones stay listed', async () => {
    const { user: agency, company } = await agencyWithAgreement()
    assert.equal(await AuditEvent.countDocuments({ type: 'jobs.agreement_published' }), 1)
    await uploadAgreement(agency, [...AGREEMENT, 'Version two.'])
    let overview = (await api().get(`${v1}/agency/agreement`).set(auth(agency))).body
    assert.deepEqual([overview.current.version, overview.draft.version, overview.earlier], [1, 2, []])
    assert.ok(overview.current.file.url)
    await publish(agency)
    overview = (await api().get(`${v1}/agency/agreement`).set(auth(agency))).body
    assert.deepEqual([overview.current.version, overview.draft, overview.earlier.map((item) => item.version)], [2, null, [1]])
    // Deleting a draft removes its file; there is none now.
    assert.equal((await api().delete(`${v1}/agency/agreement/draft`).set(auth(agency))).status, 404)
    assert.equal(await AgencyAgreement.countDocuments({ companyId: company._id }), 2)
  })

  it('is for approved agencies only', async () => {
    const { user: recruiter } = await approvedRecruiter()
    assert.equal(code(await api().get(`${v1}/agency/agreement`).set(auth(recruiter))), 'FORBIDDEN')
  })
})

describe('the books', () => {
  it('takes a candidate from request to agreement, and asks again after a new version', async () => {
    const { user: agency, company } = await approvedAgency()
    const candidate = await listedCandidate({ fullName: 'Lena London' })
    const requested = await join(candidate, company)
    assert.deepEqual([requested.status, requested.body.status, requested.body.agency.displayName, requested.body.agreement], [201, 'requested', company.displayName, null])
    assert.deepEqual((await join(candidate, company)).body.error.params, { status: 'requested' })

    // Nobody is taken on before the agreement is published.
    const [request] = (await talent(agency)).items
    assert.deepEqual((await agencyAction(agency, request.id, 'accept')).body.error.params, { reason: 'no_agreement' })
    await uploadAgreement(agency)
    await draftRules(agency, RULES)
    await publish(agency)
    const accepted = await agencyAction(agency, request.id, 'accept')
    assert.deepEqual([accepted.body.status, accepted.body.needsAgreement, accepted.body.candidate.name], ['awaiting_agreement', true, 'Lena London'])

    const read = (await api().get(`${v1}/candidate/agencies/memberships/${request.id}/agreement`).set(auth(candidate))).body
    assert.deepEqual([read.version, read.rules], [1, RULES])
    assert.ok(read.file.url)
    assert.deepEqual((await agree(candidate, request.id, 2)).body.error.params, { reason: 'agreement_changed', version: 1 })
    const agreed = await agree(candidate, request.id, 1)
    assert.deepEqual([agreed.body.status, agreed.body.acceptedVersion, agreed.body.needsAgreement], ['active', 1, false])
    assert.deepEqual((await AgencyMembership.findById(request.id)).acceptances.map(({ version, name }) => [version, name]), [[1, 'Lena London']])

    // A new version: still on the books, asked to agree again; version 1 applies meanwhile.
    await uploadAgreement(agency, [...AGREEMENT, 'Version two.'])
    await publish(agency)
    const [onBooks] = (await talent(agency, 'active')).items
    assert.deepEqual([onBooks.status, onBooks.acceptedVersion, onBooks.needsAgreement], ['active', 1, true])
    assert.equal((await api().get(`${v1}/agency/agreement`).set(auth(agency))).body.current.agreed, 0)
    assert.equal((await agree(candidate, request.id, 2)).body.needsAgreement, false)
    assert.deepEqual((await agree(candidate, request.id, 2)).body.error.params, { reason: 'already_agreed' })

    // Either side ends it; the candidate can ask again.
    const ended = await api().post(`${v1}/candidate/agencies/memberships/${request.id}/end`).set(auth(candidate))
    assert.deepEqual([ended.body.status, ended.body.endedBy], ['ended', 'candidate'])
    assert.ok(Date.parse(ended.body.endedAt) <= Date.now(), 'an ended membership says when it ended')
    assert.equal((await join(candidate, company)).body.status, 'requested')
    assert.equal((await api().get(`${v1}/candidate/agencies`).set(auth(candidate))).body.items[0].endedAt, null)
    const mine = (await api().get(`${v1}/candidate/agencies`).set(auth(candidate))).body.items
    assert.deepEqual(mine.map((item) => [item.status, item.acceptedVersion]), [['requested', 2]])
  })

  it('invites its applicants on any plan, other discoverable candidates with Agency Plus', async () => {
    const { user: free, company: freeCompany } = await agencyWithAgreement({ plus: false })
    const { user: plus } = await agencyWithAgreement()
    const applicant = await listedCandidate()
    const stranger = await listedCandidate()
    const hidden = await listedCandidate({ privacy: { discoverable: false, resumeVisible: false, matchingConsent: true } })
    const stage = await PipelineStage.findOne({ companyId: freeCompany._id, isEntry: true })
    await Application.create({ candidateId: applicant._id, jobId: (await Job.create({ companyId: freeCompany._id, title: 'Driver' }))._id, companyId: freeCompany._id, stageId: stage._id, status: 'applied', consentAt: new Date(), appliedAt: new Date() })
    const invite = (agency, candidate) => api().post(`${v1}/agency/talent/invite`).set(auth(agency)).send({ candidateId: String(candidate._id) })

    const invited = await invite(free, applicant)
    assert.deepEqual([invited.status, invited.body.status, invited.body.requestedBy], [201, 'awaiting_agreement', 'agency'])
    assert.equal(code(await invite(free, stranger)), 'PLAN_REQUIRED')
    assert.equal((await invite(plus, stranger)).status, 201)
    assert.equal((await invite(plus, hidden)).status, 404)
    assert.deepEqual((await invite(free, applicant)).body.error.params, { status: 'awaiting_agreement' })

    // The candidate turns the invitation down; on several agencies' books at once is fine.
    const mine = (await api().get(`${v1}/candidate/agencies`).set(auth(stranger))).body.items
    const declined = await api().post(`${v1}/candidate/agencies/memberships/${mine[0].id}/decline`).set(auth(stranger))
    assert.deepEqual([declined.body.status, (await agree(applicant, invited.body.id, 1)).body.status], ['declined', 'active'])
  })

  it('accepts a request through an invitation, and the agency can decline or end', async () => {
    const { user: agency, company } = await agencyWithAgreement()
    const asking = await listedCandidate()
    const other = await listedCandidate()
    await join(asking, company)
    const invited = await api().post(`${v1}/agency/talent/invite`).set(auth(agency)).send({ candidateId: String(asking._id) })
    assert.deepEqual([invited.body.status, invited.body.requestedBy], ['awaiting_agreement', 'candidate'])
    const second = (await join(other, company)).body
    assert.equal((await agencyAction(agency, second.id, 'decline')).body.status, 'declined')
    await agree(asking, invited.body.id, 1)
    const ended = await agencyAction(agency, invited.body.id, 'end')
    assert.deepEqual([ended.body.status, ended.body.endedBy], ['ended', 'agency'])
    assert.equal((await talent(agency)).counts.ended, 1)
  })

  it('joins only approved agencies', async () => {
    const candidate = await listedCandidate()
    const { company: recruiterCompany } = await approvedRecruiter()
    assert.equal((await join(candidate, recruiterCompany)).status, 404)
  })
})

describe('job contract rules', () => {
  it('blocks publishing until the contract rules are confirmed, and a new PDF needs them again', async () => {
    const { user: agency } = await approvedAgency()
    const client = (await api().post(`${v1}/agency/clients`).set(auth(agency)).send({ name: 'Acme' })).body
    const job = (await api().post(`${v1}/recruiter/jobs`).set(auth(agency)).send(jobBody({ agency: { clientId: client.id, startDate: '2026-12-01', endDate: '2026-12-31', rate: { amountMinor: 1500, period: 'hour' } } }))).body
    const contract = async (lines) => attach(api().post(`${v1}/recruiter/jobs/${job.id}/contract`).set(auth(agency)), await textPdf(lines), 'assignment.pdf', 'application/pdf')
    const terms = ['Assignment at Acme', 'The Worker may not work for Acme through any other agency for 90 days after this Assignment ends.']
    await contract(terms)
    const blocked = await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(agency)).send({ status: 'published' })
    assert.deepEqual(blocked.body.error.fields, { 'agency.contract': 'rules_unconfirmed' })

    aiAnswers({ coolingOffDays: { value: 90, clause: terms[1] } })
    const read = await api().post(`${v1}/recruiter/jobs/${job.id}/contract/read`).set(auth(agency))
    assert.deepEqual([read.body.agency.contract.aiRules.coolingOffDays, read.body.agency.contract.confirmedAt], [{ value: 90, clause: terms[1] }, null])
    const confirmed = await api().put(`${v1}/recruiter/jobs/${job.id}/contract/rules`).set(auth(agency)).send(read.body.agency.contract.rules)
    assert.ok(confirmed.body.agency.contract.confirmedAt)
    assert.equal((await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(agency)).send({ status: 'published' })).status, 200)

    const replaced = await contract(['A new assignment text.'])
    assert.deepEqual([replaced.body.agency.contract.confirmedAt, replaced.body.agency.contract.rules.coolingOffDays], [null, NONE])
  })
})

describe('agency notifications (phase 4)', () => {
  it('tells the agency in the bell and by email when someone asks to join, agrees and leaves', async () => {
    const { user: agency, company } = await agencyWithAgreement()
    const candidate = await listedCandidate({ fullName: 'Nora North' })
    const joined = (await join(candidate, company)).body
    await agencyAction(agency, joined.id, 'accept')
    await agree(candidate, joined.id, 1)
    await api().post(`${v1}/candidate/agencies/memberships/${joined.id}/end`).set(auth(candidate))
    const bell = (await api().get(`${v1}/notifications`).set(auth(agency))).body.items
    assert.deepEqual(bell.map((item) => item.type).sort(), ['agency_join_requested', 'agency_member_agreed', 'agency_member_left'])
    assert.equal(bell.find((item) => item.type === 'agency_join_requested').path, '/agency/talent?tab=requests')
    const mails = mailTo(agency.email, 'agency_update').map((mail) => mail.params.summary)
    assert.deepEqual(mails, ['Nora North asked to join your books.', 'Nora North agreed to version 1 of your agreement.', 'Nora North left your books.'])
  })
})
