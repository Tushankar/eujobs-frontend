import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { signedUrl } from '../lib/files.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Certificate, Enrollment } from '../modules/learning/learning.model.js'
import { Payment, Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'

useTestDb([User, AuditEvent, CandidateProfile, VerificationSubmission, Subscription, Payment, Company, Job, Application, File, Enrollment, Certificate])
before(async () => {
  await AdminRole.deleteMany({ system: false })
  await seedCatalog()
})

const v1 = '/api/v1'
const owner = (fields) => createUser({ role: 'admin', isOwner: true, fullName: 'Workspace admin', ...fields })
const get = (admin, path) => api().get(`${v1}${path}`).set(auth(admin))
const submit = (user, category, status) => VerificationSubmission.create({ userId: user._id, category, status, submittedAt: new Date() })

/** Five candidates, one per verification state, plus a Plus subscriber in Berlin. */
async function candidates() {
  const verified = await listedCandidate({ fullName: 'Vera Verified' })
  for (const category of ['identity', 'academic', 'employment']) await submit(verified, category, 'approved')
  const partial = await listedCandidate({ fullName: 'Paula Partial', profile: { rightToWork: [{ region: 'uk', status: 'citizen_settled' }] } })
  await submit(partial, 'identity', 'approved')
  await submit(partial, 'academic', 'approved')
  const reviewing = await listedCandidate({ fullName: 'Ivan Inreview', city: 'berlin' })
  await submit(reviewing, 'identity', 'in_review')
  await Subscription.create({ userId: reviewing._id, status: 'active', currency: 'EUR', amountMinor: 1000 })
  const rejected = await listedCandidate({ fullName: 'Rita Rejected', profile: { completeness: { done: 6, total: 12, complete: false, missing: [] } } })
  await submit(rejected, 'identity', 'rejected')
  const fresh = await createUser({ role: 'candidate', status: 'unverified', fullName: 'Nora New', emailVerifiedAt: null })
  return { verified, partial, reviewing, rejected, fresh }
}

describe('admin Candidates and Recruiters (M-161, M-169, M-206)', () => {
  it('shows the M-169 columns with filters and server pagination', async () => {
    const admin = await owner()
    const { partial, reviewing } = await candidates()
    const all = await get(admin, '/admin/users?role=candidate')
    assert.equal(all.body.total, 5)
    const byName = Object.fromEntries(all.body.items.map((row) => [row.fullName, row]))
    assert.deepEqual(byName['Vera Verified'].verification, { state: 'verified', count: 3 })
    assert.deepEqual(byName['Paula Partial'].verification, { state: 'partial', count: 2 })
    assert.deepEqual(byName['Ivan Inreview'].verification, { state: 'in_review', count: 0 })
    assert.deepEqual(byName['Rita Rejected'].verification, { state: 'not_started', count: 0 })
    assert.deepEqual(byName['Nora New'].verification, { state: 'not_started', count: 0 })
    assert.deepEqual([byName['Rita Rejected'].completeness, byName['Vera Verified'].completeness, byName['Nora New'].completeness], [50, 100, 0])
    assert.deepEqual([byName['Ivan Inreview'].plan, byName['Ivan Inreview'].country], ['plus', 'DE'])
    assert.deepEqual(byName['Paula Partial'].rightToWork, [{ region: 'uk', status: 'citizen_settled', valid: true }])

    const ids = async (query) => (await get(admin, `/admin/users?role=candidate&${query}`)).body.items.map((row) => row.id)
    assert.deepEqual(await ids('country=DE'), [String(reviewing._id)])
    assert.deepEqual(await ids('plan=plus'), [String(reviewing._id)])
    assert.deepEqual(await ids('verification=partial'), [String(partial._id)])
    assert.deepEqual(await ids('rightToWork=uk'), [String(partial._id)])
    assert.equal((await ids('rightToWork=none')).length, 4)
    assert.equal((await ids('status=unverified')).length, 1)
    assert.equal((await ids('q=paula')).length, 1)
    const page = await get(admin, '/admin/users?role=candidate&pageSize=2&page=3')
    assert.deepEqual([page.body.items.length, page.body.total, page.body.page, page.body.pageSize], [1, 5, 3, 2])
    assert.equal((await get(admin, '/admin/users?role=candidate&pageSize=101')).body.error.fields.pageSize, 'too_big')
  })

  it('maps recruiter statuses to Pending, Approved, Rejected and Suspended', async () => {
    const admin = await owner()
    await approvedRecruiter({ fullName: 'Ada Approved' })
    await approvedRecruiter({ fullName: 'Sam Suspended', status: 'suspended', city: 'dublin' })
    await createUser({ role: 'recruiter', status: 'onboarding', fullName: 'Olga Onboarding' })
    const res = await get(admin, '/admin/users?role=recruiter')
    assert.deepEqual(Object.fromEntries(res.body.items.map((row) => [row.fullName, row.state])), { 'Ada Approved': 'approved', 'Sam Suspended': 'suspended', 'Olga Onboarding': 'pending' })
    assert.deepEqual((await get(admin, '/admin/users?role=recruiter&state=pending')).body.items.map((row) => row.fullName), ['Olga Onboarding'])
    assert.deepEqual((await get(admin, '/admin/users?role=recruiter&country=IE')).body.items.map((row) => row.company.displayName), ['Sam Suspended Studio'])
  })

  it('exports the filtered rows as an audited CSV in the admin’s language', async () => {
    const admin = await owner({ language: 'es' })
    await candidates()
    const res = await get(admin, '/admin/users/export?role=candidate&verification=partial')
    assert.equal(res.status, 200)
    assert.match(res.headers['content-type'], /^text\/csv; charset=utf-8/)
    assert.match(res.headers['content-disposition'], /candidates-\d{4}-\d{2}-\d{2}\.csv/)
    assert.ok(res.text.startsWith('\uFEFFNombre,Correo electrónico,Alta,Estado,País,Permiso de trabajo,Verificación'))
    const [, row] = res.text.trim().split('\r\n')
    assert.match(row, /^Paula Partial,.*,Activa,GB,Reino Unido,2 de 3 verificadas,100,Free,0,0$/)
    const [event] = await AuditEvent.find({ category: 'reports' })
    assert.deepEqual([event.type, event.params.count, event.actor.type], ['reports.candidates_exported', 1, 'admin'])
  })

  it('opens the candidate and recruiter detail pages', async () => {
    const admin = await owner()
    const { verified } = await candidates()
    const { user: recruiter, company } = await approvedRecruiter({ fullName: 'Rae Recruiter' })
    const job = await Job.create({ ...jobBody(), companyId: company._id, createdBy: recruiter._id, status: 'published', country: 'GB', requiredSkills: [], preferredSkills: [] })
    const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
    await Application.create({ candidateId: verified._id, jobId: job._id, companyId: company._id, stageId: stage._id, status: 'applied', consentAt: new Date(), appliedAt: new Date() })
    const candidate = (await get(admin, `/admin/users/${verified._id}`)).body
    assert.equal(candidate.role, 'candidate')
    assert.equal(candidate.verification.state, 'verified')
    assert.equal(candidate.verification.submissions.length, 3)
    assert.deepEqual(candidate.applications.map((row) => [row.job.title, row.company, row.status]), [['Senior Product Designer', 'Rae Recruiter Studio', 'applied']])
    assert.deepEqual(candidate.plan, { plan: 'free', subscription: null })
    assert.equal(candidate.profile.completeness.percent, 100)
    const detail = (await get(admin, `/admin/users/${recruiter._id}`)).body
    assert.deepEqual([detail.state, detail.company.displayName, detail.jobs.published, detail.applications.total], ['approved', 'Rae Recruiter Studio', 1, 1])
    assert.equal((await get(admin, `/admin/users/${admin._id}`)).status, 404)
  })
})

describe('admin Payments (M-122, M-123, P10-Q5 … Q7)', () => {
  let n = 0
  const pay = (user, fields) =>
    Payment.create({ reference: `LWM-T${++n}`, userId: user?._id, payerRole: user?.role, payerName: user?.fullName, kind: 'course', itemName: 'Course', amountMinor: 1900, currency: 'GBP', status: 'paid', paidAt: new Date(Date.now() - n * 1000), ...fields })

  async function rows() {
    const london = await listedCandidate({ fullName: 'Lena London' })
    const berlin = await listedCandidate({ fullName: 'Bruno Berlin', city: 'berlin' })
    const { user: recruiter } = await approvedRecruiter({ fullName: 'Rhea Recruiter', city: 'dublin' })
    await pay(london, { kind: 'subscription', itemName: 'Plus', amountMinor: 900 })
    await pay(london, { kind: 'subscription', itemName: 'Plus', amountMinor: 900, status: 'failed', failureReason: 'card_declined' })
    await pay(berlin, { amountMinor: 2200, currency: 'EUR' })
    await pay(berlin, { amountMinor: 3400, currency: 'EUR', status: 'refunded' })
    await pay(recruiter, { amountMinor: 4900 })
    await pay(london, { source: 'seed', amountMinor: 1900 })
    await Subscription.create({ userId: london._id, status: 'active', currency: 'GBP', amountMinor: 900 })
    await Subscription.create({ userId: berlin._id, status: 'past_due', retrying: true, currency: 'EUR', amountMinor: 1000 })
    await Subscription.create({ userId: recruiter._id, status: 'canceled', currency: 'GBP', amountMinor: 900 })
    return { london, berlin, recruiter }
  }

  it('lists every row with the filters, the payer country and the seed source', async () => {
    const admin = await owner()
    await rows()
    const list = async (query = '') => (await get(admin, `/admin/payments?${query}`)).body
    assert.equal((await list()).total, 6)
    assert.deepEqual((await list('status=refunded')).items.map((row) => row.amountMinor), [3400])
    assert.deepEqual((await list('payer=recruiter')).items.map((row) => [row.payerName, row.payerCountry]), [['Rhea Recruiter', 'IE']])
    assert.equal((await list('kind=subscription')).total, 2)
    assert.equal((await list('source=seed')).total, 1)
    assert.equal((await list('country=DE')).total, 2)
    assert.equal((await list('q=bruno')).total, 2)
    assert.deepEqual([(await list('pageSize=4&page=2')).items.length, (await list('pageSize=4&page=2')).total], [2, 6])
  })

  it('answers all-time cards per currency that follow only the country filter', async () => {
    const admin = await owner()
    await rows()
    const stats = (await get(admin, '/admin/payments/stats')).body
    assert.deepEqual(stats, {
      collected: [{ currency: 'GBP', amountMinor: 900 + 4900 + 1900 }, { currency: 'EUR', amountMinor: 2200 }],
      activeSubscribers: 2,
      mrr: [{ currency: 'EUR', amountMinor: 1000 }, { currency: 'GBP', amountMinor: 900 }],
      failedRenewals: 1,
    })
    const germany = (await get(admin, '/admin/payments/stats?country=DE')).body
    assert.deepEqual(germany, { collected: [{ currency: 'EUR', amountMinor: 2200 }], activeSubscribers: 1, mrr: [{ currency: 'EUR', amountMinor: 1000 }], failedRenewals: 0 })
  })

  it('shows the subscription status and period in a plan payment’s details, and exports', async () => {
    const admin = await owner()
    await rows()
    const failed = await Payment.findOne({ status: 'failed' })
    const detail = (await get(admin, `/admin/payments/${failed._id}`)).body
    assert.deepEqual([detail.subscription.status, detail.subscription.paid, detail.failureReason], ['active', true, 'card_declined'])
    const csv = await get(admin, '/admin/payments/export?payer=candidate&status=failed')
    assert.ok(csv.text.startsWith('\uFEFFReference,Date,Payer,Payer type,Item,Type,Amount,Currency,Method,Status,Failure reason,Source'))
    assert.match(csv.text.trim().split('\r\n')[1], /^LWM-T\d+,.*,Lena London,Candidate,Plus,Subscription,9\.00,GBP,,Failed,card_declined,Stripe$/)
    assert.equal((await AuditEvent.findOne({ type: 'reports.payments_exported' })).params.count, 1)
  })
})

describe('admin Audit logs (M-162, M-163)', () => {
  it('records recruiter job status changes and CV downloads in the Jobs category', async () => {
    const { user: recruiter } = await approvedRecruiter({ fullName: 'Rae Recruiter' })
    const draft = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody())
    await api().patch(`${v1}/recruiter/jobs/${draft.body.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    const candidate = await listedCandidate({ fullName: 'Cleo Candidate' })
    const cv = await File.create({ ownerId: candidate._id, purpose: 'cv', path: 'cv/none.pdf', originalName: 'cv.pdf', mime: 'application/pdf', size: 10 })
    await api().get(signedUrl(cv, recruiter._id))
    const events = await AuditEvent.find({ category: 'jobs' }).sort({ at: 1 })
    assert.deepEqual(events.map((event) => [event.type, event.actor.type, event.actor.name]), [
      ['jobs.status_changed', 'user', 'Rae Recruiter'],
      ['jobs.cv_downloaded', 'user', 'Rae Recruiter'],
    ])
    assert.deepEqual(events[0].params, { title: 'Senior Product Designer', company: 'Rae Recruiter Studio', from: 'draft', to: 'published' })
    assert.equal(events[1].params.candidate, 'Cleo Candidate')
  })

  it('filters by category, actor type and text, pages, and exports the sentences in French', async () => {
    const admin = await owner({ language: 'fr' })
    const at = new Date()
    await AuditEvent.insertMany([
      { type: 'jobs.status_changed', category: 'jobs', actor: { type: 'user', name: 'Rae' }, params: { title: 'Designer', company: 'Acme', from: 'draft', to: 'published' }, at },
      { type: 'payments.payment_refunded', category: 'payments', actor: { type: 'system' }, params: { reference: 'LWM-000009', payer: 'Lena', item: 'Plus', amountMinor: 900, currency: 'GBP' }, at },
      { type: 'access.role_created', category: 'access', actor: { type: 'admin', name: 'Workspace admin' }, params: { role: 'Support' }, at },
    ])
    const list = async (query) => (await get(admin, `/admin/audit-events?${query}`)).body
    assert.deepEqual((await list('category=payments')).items.map((event) => event.type), ['payments.payment_refunded'])
    assert.deepEqual((await list('actorType=system')).items.map((event) => event.actor), [{ type: 'system', name: null }])
    assert.deepEqual((await list('q=support')).items.map((event) => event.type), ['access.role_created'])
    assert.deepEqual([(await list('pageSize=2')).items.length, (await list('pageSize=2')).total], [2, 3])
    const csv = await get(admin, '/admin/audit-events/export?category=jobs')
    const lines = csv.text.trim().split('\r\n')
    assert.ok(csv.text.startsWith('\uFEFF'))
    assert.equal(lines[0], 'Date,Catégorie,Type d’acteur,Acteur,Événement')
    assert.match(lines[1], /,Offres,Utilisateur,Rae,"Statut de l’offre modifié : Designer \(Acme\), Brouillon → Publiée"$/)
    const refund = await get(admin, '/admin/audit-events/export?category=payments')
    assert.match(refund.text, /Paiement remboursé LWM-000009 : Lena, Plus \(9,00\s£GB\)/)
    assert.ok(await AuditEvent.exists({ type: 'reports.audit_exported' }))
  })
})
