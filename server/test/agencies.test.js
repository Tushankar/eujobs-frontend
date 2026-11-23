import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { AgencyClient } from '../modules/agencies/agencies.model.js'
import { clientNameKey } from '../modules/agencies/agencies.service.js'
import { PipelineStage } from '../modules/applications/applications.model.js'
import { VerificationCode } from '../modules/auth/auth.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Plan, Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLANS } from '../seed/data/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { image, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, finishLogin, mailTo, PASSWORD, testEmail, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedAgency, approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

/* 2026-11-20 (agencies, phase 1): the agency role, its sign-up and review, clients, agency jobs and the shared hiring tools. */

useTestDb([User, Company, KycDocument, PipelineStage, VerificationCode, File, AuditEvent, AgencyClient, Job, CandidateProfile, Subscription, Conversation, Message])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
const login = (email, portal) => api().post(`${v1}/auth/login`).send({ email, password: PASSWORD, portal })
const addClient = (agency, body) => api().post(`${v1}/agency/clients`).set(auth(agency)).send(body)
const createJob = (user, body) => api().post(`${v1}/recruiter/jobs`).set(auth(user)).send(body)
const setStatus = (user, id, status) => api().patch(`${v1}/recruiter/jobs/${id}/status`).set(auth(user)).send({ status })
const terms = (clientId, overrides = {}) => ({ clientId, showClient: false, startDate: '2026-12-01', endDate: '2026-12-31', rate: { amountMinor: 1850, period: 'hour' }, hoursPerWeek: 30, ...overrides })

describe('agency accounts (sign-up, sign-in, review)', () => {
  it('signs an agency up at the email code, then opens onboarding', async () => {
    const email = testEmail('agency')
    const res = await api().post(`${v1}/auth/agency/register`).send({
      fullName: 'Ada Agent',
      email,
      password: 'Harbour-Lantern-58',
      acceptTerms: true,
      language: 'en',
      country: 'GB',
      jobTitle: 'Agency director',
      phone: '+44 20 7946 0000',
    })
    assert.equal(res.status, 201)
    assert.deepEqual([res.body.me.role, res.body.me.status], ['agency', 'unverified'])
    const token = res.body.token
    const blocked = await api().get(`${v1}/recruiter/onboarding`).set('Authorization', `Bearer ${token}`)
    assert.equal(code(blocked), 'EMAIL_UNVERIFIED')
    const { code: emailCode } = mailTo(email, 'recruiter_email_code').at(-1).params
    const verified = await api().post(`${v1}/auth/email-code/verify`).set('Authorization', `Bearer ${token}`).send({ code: emailCode })
    assert.deepEqual([verified.status, verified.body.status], [200, 'onboarding'])
    const onboarding = await api().get(`${v1}/recruiter/onboarding`).set('Authorization', `Bearer ${token}`)
    assert.deepEqual([onboarding.status, onboarding.body.currentStep], [200, 'company'])
  })

  it('keeps the agency portal for agencies only, and agencies only there', async () => {
    const { user: agency } = await approvedAgency()
    const { user: recruiter } = await approvedRecruiter()
    const candidate = await createUser()
    for (const portal of ['candidate', 'recruiter']) assert.equal(code(await login(agency.email, portal)), 'INVALID_CREDENTIALS')
    for (const user of [recruiter, candidate]) assert.equal(code(await login(user.email, 'agency')), 'INVALID_CREDENTIALS')
    const res = await finishLogin(await login(agency.email, 'agency'))
    assert.deepEqual([res.status, res.body.me.role], [200, 'agency'])
  })

  it('lists submitted agencies apart from recruiters and approves them with the agency sign-in link', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const agency = await createUser({ role: 'agency', status: 'pending_review', fullName: 'Waiting Agency' })
    await Company.create({ ownerUserId: agency._id, legalName: 'Waiting Agency Ltd', displayName: 'Waiting Agency Ltd', location: PLACES.london, submittedAt: new Date() })
    await createUser({ role: 'recruiter', status: 'pending_review', fullName: 'Waiting Recruiter' })
    const list = async (role) => (await api().get(`${v1}/admin/moderation/accounts`).query({ role }).set(auth(owner))).body
    const agencies = await list('agency')
    assert.deepEqual([agencies.items.map((item) => [item.fullName, item.role]), agencies.counts.pending_review], [[['Waiting Agency', 'agency']], 1])
    assert.deepEqual((await list()).items.map((item) => item.fullName), ['Waiting Recruiter'])

    const res = await api().post(`${v1}/admin/moderation/accounts/${agency._id}/decision`).set(auth(owner)).send({ decision: 'approved' })
    assert.deepEqual([res.status, res.body.status], [200, 'active'])
    const [approved] = mailTo(agency.email, 'recruiter_approved')
    assert.match(approved.params.link, /\/agencies\/login$/)
    // 2026-11-23: the agency's own wording, not the recruiter's.
    assert.equal(approved.subject, 'Your agency account is approved')
    assert.ok(approved.text.includes('Your agency workspace is now open') && !approved.text.includes('recruiter'))
    assert.equal(await PipelineStage.countDocuments({ companyId: (await Company.findOne({ ownerUserId: agency._id }))._id }), 6)

    // Rejected and suspended agencies get the agency texts too, in their language.
    await api().post(`${v1}/admin/moderation/accounts/${agency._id}/decision`).set(auth(owner)).send({ decision: 'suspended', reason: 'Documents expired' })
    assert.equal(mailTo(agency.email, 'recruiter_suspended')[0].subject, 'Your agency account is suspended')
    const french = await createUser({ role: 'agency', status: 'pending_review', language: 'fr' })
    await api().post(`${v1}/admin/moderation/accounts/${french._id}/decision`).set(auth(owner)).send({ decision: 'rejected', reason: 'Nom illisible' })
    assert.equal(mailTo(french.email, 'recruiter_rejected')[0].subject, 'Votre compte agence doit être complété')
  })

  it('gives agencies the Agency plans and their entitlements', async () => {
    const plans = (await api().get(`${v1}/plans`).query({ role: 'agency', currency: 'GBP' })).body.items
    assert.deepEqual(plans.map((plan) => [plan.key, plan.price?.amountMinor]), [['agency_free', 0], ['agency_plus', 4900]])
    const { user: free } = await approvedAgency({ plus: false })
    const { user: plus } = await approvedAgency()
    assert.deepEqual([(await api().get(`${v1}/me`).set(auth(free))).body.plan, (await api().get(`${v1}/me`).set(auth(plus))).body.plan], ['free', 'agency_plus'])
    const own = (await api().get(`${v1}/plans`).set(auth(plus))).body.items
    assert.deepEqual(own.map((plan) => plan.key), ['agency_free', 'agency_plus'])
    // The shortlist needs the discovery entitlement of Agency Plus.
    assert.equal((await api().get(`${v1}/recruiter/shortlist`).set(auth(free))).status, 402)
    assert.equal((await api().get(`${v1}/recruiter/shortlist`).set(auth(plus))).status, 200)
  })
})

describe('agency clients', () => {
  it('normalises client names', () => {
    assert.equal(clientNameKey('Acme Ltd'), 'acme')
    assert.equal(clientNameKey('ACME'), 'acme')
    assert.equal(clientNameKey('Acme, Inc.'), 'acme')
    assert.equal(clientNameKey('Société Générale S.A.'), 'societe generale')
    assert.equal(clientNameKey('Marks & Spencer plc'), 'marks and spencer')
  })

  it('adds, renames, links and removes clients; a name is used once', async () => {
    const { user: agency } = await approvedAgency()
    const { company: linked } = await approvedRecruiter()
    const { company: otherAgency } = await approvedAgency()
    const created = await addClient(agency, { name: 'Acme Ltd', industry: 'Logistics', placeId: PLACES.london.placeId })
    assert.equal(created.status, 201)
    assert.deepEqual([created.body.name, created.body.location.city, created.body.jobs, created.body.linkedCompany], ['Acme Ltd', 'London', 0, null])
    assert.deepEqual((await addClient(agency, { name: 'ACME' })).body.error.fields, { name: 'duplicate' })

    // Only recruiter companies can be linked; search finds them by name, never agencies.
    const search = (q) => api().get(`${v1}/agency/clients/companies`).query({ q }).set(auth(agency))
    assert.deepEqual((await search(linked.displayName.slice(0, 6))).body.items.map((item) => item.id), [String(linked._id)])
    assert.deepEqual((await search(otherAgency.displayName.slice(0, 6))).body.items.map((item) => item.id), [String(linked._id)])
    const put = (body) => api().put(`${v1}/agency/clients/${created.body.id}`).set(auth(agency)).send(body)
    assert.deepEqual((await put({ name: 'Acme', linkedCompanyId: String(otherAgency._id) })).body.error.fields, { linkedCompanyId: 'invalid' })
    const updated = await put({ name: 'Acme Logistics', linkedCompanyId: String(linked._id) })
    assert.deepEqual([updated.status, updated.body.name, updated.body.linkedCompany.id, updated.body.location], [200, 'Acme Logistics', String(linked._id), null])

    const logo = await attach(api().post(`${v1}/agency/clients/${created.body.id}/logo`).set(auth(agency)), await image('png'), 'acme.png', 'image/png')
    assert.ok(logo.body.logoUrl)
    assert.equal(await File.countDocuments({ purpose: 'client_logo' }), 1)

    const del = await api().delete(`${v1}/agency/clients/${created.body.id}`).set(auth(agency))
    assert.equal(del.status, 204)
    assert.equal(await File.countDocuments({ purpose: 'client_logo' }), 0)
    assert.deepEqual((await api().get(`${v1}/agency/clients`).set(auth(agency))).body.items, [])
  })

  it('keeps clients to approved agencies and their own clients', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const pending = await createUser({ role: 'agency', status: 'pending_review' })
    const { user: agency } = await approvedAgency()
    const { user: other } = await approvedAgency()
    assert.equal(code(await api().get(`${v1}/agency/clients`).set(auth(recruiter))), 'FORBIDDEN')
    assert.equal(code(await api().get(`${v1}/agency/clients`).set(auth(pending))), 'RECRUITER_NOT_APPROVED')
    const client = (await addClient(agency, { name: 'Acme' })).body
    assert.equal((await api().get(`${v1}/agency/clients/${client.id}`).set(auth(other))).status, 404)
  })
})

describe('agency jobs', () => {
  it('saves a draft, publishes with the client, dates and rate, and never shows the client id to candidates', async () => {
    const { user: agency } = await approvedAgency()
    const client = (await addClient(agency, { name: 'Acme' })).body
    const draft = await createJob(agency, jobBody())
    assert.equal(draft.status, 201)
    assert.deepEqual(draft.body.agency, { showClient: true, startDate: null, endDate: null, rate: null, hoursPerWeek: null, clientId: null, contract: null })

    const missing = await setStatus(agency, draft.body.id, 'published')
    assert.equal(missing.status, 422)
    assert.deepEqual([missing.body.error.params.step, missing.body.error.fields], [
      'agency',
      { 'agency.clientId': 'required', 'agency.startDate': 'required', 'agency.endDate': 'required', 'agency.rate.amountMinor': 'required' },
    ])

    const updated = await api().put(`${v1}/recruiter/jobs/${draft.body.id}`).set(auth(agency)).send(jobBody({ agency: terms(client.id) }))
    assert.deepEqual(updated.body.agency, {
      showClient: false,
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      rate: { amountMinor: 1850, currency: 'GBP', period: 'hour' },
      hoursPerWeek: 30,
      clientId: client.id,
      contract: null,
    })
    assert.equal((await setStatus(agency, draft.body.id, 'published')).status, 200)

    const candidate = await listedCandidate()
    const found = (await api().get(`${v1}/jobs`).set(auth(candidate))).body.items.find((item) => item.id === draft.body.id)
    assert.equal(found.company.displayName, (await Company.findById(agency.companyId)).displayName)
    // 2026-11-20 (phase 5): a confidential client has no name either.
    assert.deepEqual(found.agency, { showClient: false, startDate: '2026-12-01', endDate: '2026-12-31', rate: { amountMinor: 1850, currency: 'GBP', period: 'hour' }, hoursPerWeek: 30, client: null })
    assert.deepEqual(found.agencyMembership, null)

    // Shown, the client's name is on the card (and on the public list); the Agency job type finds it.
    await api().put(`${v1}/recruiter/jobs/${draft.body.id}`).set(auth(agency)).send(jobBody({ agency: { ...terms(client.id), showClient: true } }))
    const agencyOnly = (await api().get(`${v1}/jobs`).query({ employmentType: 'agency' }).set(auth(candidate))).body.items
    assert.deepEqual(agencyOnly.map((item) => [item.id, item.agency.client]), [[draft.body.id, { name: 'Acme' }]])
    assert.equal((await api().get(`${v1}/jobs`).query({ employmentType: 'contract' }).set(auth(candidate))).body.items.length, 0)
    const publicList = (await api().get(`${v1}/landing/jobs`).query({ employmentType: 'agency' })).body
    assert.deepEqual([publicList.counts.employmentType.agency, publicList.items.map((item) => item.agency.client)], [1, [{ name: 'Acme' }]])

    // A client with jobs stays.
    const del = await api().delete(`${v1}/agency/clients/${client.id}`).set(auth(agency))
    assert.deepEqual([del.status, del.body.error.params], [409, { reason: 'client_has_jobs', jobs: 1 }])
  })

  it('checks the agency terms', async () => {
    const { user: agency } = await approvedAgency()
    const { user: other } = await approvedAgency()
    const { user: recruiter } = await approvedRecruiter()
    const client = (await addClient(agency, { name: 'Acme' })).body
    const foreign = (await addClient(other, { name: 'Elsewhere' })).body
    const fields = async (user, body) => (await createJob(user, body)).body.error.fields
    assert.deepEqual(await fields(agency, jobBody({ employmentType: 'contract', agency: terms(client.id) })), { employmentType: 'not_allowed' })
    assert.deepEqual(await fields(agency, jobBody({ agency: terms(foreign.id) })), { 'agency.clientId': 'invalid' })
    assert.deepEqual(await fields(agency, jobBody({ agency: terms(client.id, { endDate: '2026-11-30' }) })), { 'agency.endDate': 'before_start' })
    assert.deepEqual(await fields(agency, jobBody({ agency: terms(client.id, { startDate: '2026-13-01' }) })), { 'agency.startDate': 'invalid' })
    assert.deepEqual(await fields(recruiter, jobBody({ agency: terms(client.id) })), { agency: 'not_allowed' })
    // A company job has no agency terms.
    assert.equal((await createJob(recruiter, jobBody())).body.agency, null)
  })

  it('attaches, opens, replaces and removes the contract PDF', async () => {
    const { user: agency } = await approvedAgency()
    const { user: recruiter } = await approvedRecruiter()
    const client = (await addClient(agency, { name: 'Acme' })).body
    const job = (await createJob(agency, jobBody({ agency: terms(client.id) }))).body
    const upload = (user, buffer, name, mime) => attach(api().post(`${v1}/recruiter/jobs/${job.id}/contract`).set(auth(user)), buffer, name, mime)
    const pdf = await textPdf('Assignment terms')
    assert.equal((await upload(agency, await image('png'), 'contract.png', 'image/png')).status, 422)
    assert.equal((await upload(recruiter, pdf, 'contract.pdf', 'application/pdf')).status, 403)

    const first = await upload(agency, pdf, 'contract.pdf', 'application/pdf')
    assert.deepEqual([first.status, first.body.agency.contract.name], [200, 'contract.pdf'])
    const replaced = await upload(agency, pdf, 'contract-v2.pdf', 'application/pdf')
    assert.equal(replaced.body.agency.contract.name, 'contract-v2.pdf')
    assert.equal(await File.countDocuments({ purpose: 'agency_contract' }), 1)
    const opened = (await api().get(`${v1}/recruiter/jobs/${job.id}/contract`).set(auth(agency))).body
    assert.equal(opened.name, 'contract-v2.pdf')
    assert.equal((await api().get(opened.url.slice(opened.url.indexOf('/api/v1')))).status, 200)

    const removed = await api().delete(`${v1}/recruiter/jobs/${job.id}/contract`).set(auth(agency))
    assert.equal(removed.body.agency.contract, null)
    assert.equal(await File.countDocuments({ purpose: 'agency_contract' }), 0)
  })
})

describe('shared hiring tools', () => {
  it('lets an agency message a candidate as the hiring side', async () => {
    const { user: agency } = await approvedAgency()
    const candidate = await listedCandidate()
    const res = await api().post(`${v1}/conversations`).set(auth(agency)).send({ candidateId: String(candidate._id), body: 'We have short contracts that fit you.' })
    assert.equal(res.status, 201)
    assert.equal((await Message.findOne()).senderRole, 'recruiter')
    const inbox = (await api().get(`${v1}/conversations`).set(auth(agency))).body.items
    assert.deepEqual(inbox.map((item) => item.unread), [0])
    assert.equal((await api().get(`${v1}/me/counters`).set(auth(candidate))).body.unreadMessages, 1)
  })
})

describe('admin and public figures (phase 4)', () => {
  it('lists agencies in their own admin table, exports them and counts pending ones per kind', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const { user: agency } = await approvedAgency()
    await approvedRecruiter()
    await createUser({ role: 'agency', status: 'pending_review', fullName: 'Waiting Agency' })
    const table = (await api().get(`${v1}/admin/users`).query({ role: 'agency' }).set(auth(owner))).body
    assert.deepEqual(table.items.map((row) => [row.email, row.plan]).sort(), [[agency.email, 'agency_plus'], [(await User.findOne({ fullName: 'Waiting Agency' })).email, 'free']].sort())
    assert.equal((await api().get(`${v1}/admin/users/${agency._id}`).set(auth(owner))).body.role, 'agency')
    const csv = await api().get(`${v1}/admin/users/export`).query({ role: 'agency' }).set(auth(owner))
    assert.match(csv.headers['content-disposition'], /agencies-\d{4}-\d{2}-\d{2}\.csv/)
    assert.equal(await AuditEvent.countDocuments({ type: 'reports.agencies_exported' }), 1)
    const queue = (await api().get(`${v1}/admin/moderation/accounts`).set(auth(owner))).body
    assert.deepEqual(queue.pending, { recruiter: 0, agency: 1 })
  })

  it('gives the /agencies page its live figures', async () => {
    const { user: agency } = await approvedAgency()
    const client = (await addClient(agency, { name: 'Acme' })).body
    const job = (await createJob(agency, jobBody({ agency: terms(client.id) }))).body
    await setStatus(agency, job.id, 'published')
    const { agencies } = (await api().get(`${v1}/landing`)).body
    assert.deepEqual(agencies, { jobs: 1, accounts: 1 })
  })
})

describe('plans and landing (phase 7)', () => {
  it('lists the newest agency jobs on the landing page with the client only where it is shown', async () => {
    assert.deepEqual((await api().get(`${v1}/landing`)).body.agencyJobs, [])
    const { user: agency } = await approvedAgency()
    const { user: recruiter } = await approvedRecruiter()
    const acme = (await addClient(agency, { name: 'Acme' })).body
    const ids = []
    // Published a minute apart (index 0 oldest), the company job last.
    const publishedAt = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000)
    for (const [index, showClient] of [true, false, true, true, true].entries()) {
      const job = (await createJob(agency, jobBody({ title: `Agency role ${index}`, agency: terms(acme.id, { showClient }) }))).body
      await setStatus(agency, job.id, 'published')
      await Job.updateOne({ _id: job.id }, { publishedAt: publishedAt(10 - index) })
      ids.unshift(job.id)
    }
    const company = (await createJob(recruiter, jobBody({ title: 'Company role' }))).body
    await setStatus(recruiter, company.id, 'published')

    const body = (await api().get(`${v1}/landing`)).body
    // The four newest agency jobs, newest first; the oldest (index 0) and the company job are left out.
    assert.deepEqual(body.agencyJobs.map((job) => job.id), ids.slice(0, 4))
    const confidential = body.agencyJobs.find((job) => job.title === 'Agency role 1')
    assert.deepEqual(confidential.agency, { showClient: false, startDate: '2026-12-01', endDate: '2026-12-31', rate: { amountMinor: 1850, currency: 'GBP', period: 'hour' }, hoursPerWeek: 30, client: null })
    assert.deepEqual(body.agencyJobs.find((job) => job.title === 'Agency role 4').agency.client, { name: 'Acme' })
    assert.equal(confidential.company.name, (await Company.findById(agency.companyId)).displayName)
    // The latest jobs carry the agency terms too; a company job has none.
    assert.deepEqual(body.jobs.map((job) => [job.title, Boolean(job.agency)]).slice(0, 2), [['Company role', false], ['Agency role 4', true]])
  })

  it('gives the agency plans their own features', async () => {
    const [free, plus] = (await api().get(`${v1}/plans`).query({ role: 'agency', language: 'en' })).body.items
    assert.ok(free.features.includes('Talent on your books, with your own versioned agreement'))
    assert.ok(plus.features.includes('AI reads your agreement and contracts and suggests the rules'))
    assert.ok(!free.features.includes('Company page and verification'))
  })

  it('replaces the earlier copied features on reseed, but keeps an admin’s own', async () => {
    const data = Object.fromEntries(PLANS.map((plan) => [plan.key, plan]))
    const own = [{ en: 'Our own line', es: 'Nuestra línea', fr: 'Notre ligne' }]
    await Plan.updateOne({ key: 'agency_free' }, { $set: { features: data.agency_free.previousFeatures } })
    await Plan.updateOne({ key: 'agency_plus' }, { $set: { features: own } })
    await seedCatalog()
    const stored = Object.fromEntries((await Plan.find({ key: { $in: ['agency_free', 'agency_plus'] } }).lean()).map((plan) => [plan.key, plan.features.map(({ en }) => en)]))
    assert.deepEqual(stored, { agency_free: data.agency_free.features.map(({ en }) => en), agency_plus: ['Our own line'] })
    await Plan.updateOne({ key: 'agency_plus' }, { $set: { features: data.agency_plus.features } })
  })
})
