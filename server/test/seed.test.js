import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import { config } from '../config/env.js'
import { absolutePath } from '../lib/files.js'
import { stripe } from '../lib/stripe.js'
import { AdminRole, Permission } from '../modules/admin/admin.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { ProfileView, RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { File } from '../modules/files/files.model.js'
import { Country, Faq, LegalDocument } from '../modules/meta/meta.model.js'
import { Payment, Plan, Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { FAQS } from '../seed/data/faqs.js'
import { LEGAL_VERSION } from '../seed/data/legal.js'
import { PLACES } from '../seed/data/places.js'
import { demoAddress, seedDemo } from '../seed/demo.js'
import { api, useTestDb, useTestUploads } from './helpers/index.js'

useTestDb()
useTestUploads()

const counts = async () => Promise.all([Country, Plan, Permission, AdminRole, Faq, LegalDocument].map((Model) => Model.countDocuments()))

describe('seed:catalog (U41)', () => {
  it('is idempotent: 29 countries, 2 plans, 21 permissions, 3 roles, the FAQs and 3 legal texts × 3 languages', async () => {
    await seedCatalog()
    const published = (await LegalDocument.findOne({ doc: 'terms', language: 'en' })).publishedAt
    await seedCatalog()
    assert.deepEqual(await counts(), [29, 2, 21, 3, FAQS.length, 9])
    assert.deepEqual((await LegalDocument.findOne({ doc: 'terms', language: 'en' })).publishedAt, published)
    assert.equal(await LegalDocument.countDocuments({ isDraft: true, version: LEGAL_VERSION }), 9)
  })

  it('stores currencies, default languages and OD1 prices', async () => {
    const country = async (code) => Country.findOne({ code }).lean()
    assert.equal((await country('BG')).currency, 'EUR')
    assert.equal((await country('HU')).currency, 'HUF')
    assert.equal((await country('GB')).currency, 'GBP')
    assert.deepEqual([(await country('REMOTE')).currency, (await country('REMOTE')).isRemote], ['EUR', true])
    assert.equal(await Country.countDocuments({ currency: 'EUR', isRemote: false }), 21)
    assert.deepEqual(
      (await Country.find({ defaultLanguage: { $ne: 'en' } }).sort({ code: 1 })).map((c) => `${c.code}:${c.defaultLanguage}`),
      ['BE:fr', 'ES:es', 'FR:fr', 'LU:fr'],
    )
    const plus = await Plan.findOne({ key: 'plus' }).lean()
    assert.deepEqual(plus.entitlements, ['apply', 'message_send', 'job_alerts', 'ai'])
    assert.equal(plus.prices.find((price) => price.currency === 'HUF').amountMinor, 399000)
    assert.equal(plus.prices.length, 8)
    const manager = await AdminRole.findOne({ name: 'Manager' }).lean()
    assert.deepEqual(manager.permissions, ['users.view', 'roles.view', 'roles.assign', 'candidates.view', 'reports.view'])
  })
})

describe('seed:demo (§3.20, OD9, P12)', () => {
  const snapshot = async () =>
    (await User.find({}, 'email role status isOwner pickerCountry').sort({ email: 1 }).lean()).map(({ email, role, status, isOwner, pickerCountry }) => ({
      email,
      role,
      status,
      isOwner,
      pickerCountry,
    }))

  it('recreates the Owner and the 4 demo accounts on plus-aliases, the same each run', async () => {
    await seedCatalog()
    await seedDemo()
    const first = await snapshot()
    await seedDemo()
    // Compared without printing: the addresses derive from SEED_ADMIN_EMAIL.
    assert.ok(JSON.stringify(await snapshot()) === JSON.stringify(first), 'the second run gives the same accounts')
    // The Owner, 4 demo accounts, the 5 recruiter-mock candidates and 9 mock-company recruiters on example.com (§3.20).
    assert.equal(first.length, 19)

    const owner = first.find((user) => user.isOwner)
    assert.ok(owner.email === config.seed.adminEmail && owner.role === 'admin', 'Owner uses SEED_ADMIN_EMAIL')
    const expected = { alex: 'candidate:active:GB', emma: 'candidate:active:GB', sarah: 'recruiter:active:GB', james: 'recruiter:pending_review:IE' }
    for (const [tag, state] of Object.entries(expected)) {
      const user = first.find((u) => u.email === demoAddress(tag))
      assert.ok(user, `+${tag} alias exists`)
      assert.equal(`${user.role}:${user.status}:${user.pickerCountry}`, state)
    }
    const exampleCom = first.filter((user) => user.email.endsWith('@example.com')).map((user) => `${user.email}:${user.pickerCountry}`)
    assert.deepEqual(exampleCom, [
      'aisha.patel@example.com:SE',
      'camille.martin@example.com:FR',
      'daniel.kim@example.com:FR',
      'erik.lund@example.com:SE',
      'ines.costa@example.com:PT',
      'james.chen@example.com:NL',
      'lena.fischer@example.com:DE',
      'lucas.meyer@example.com:NL',
      'maya.brooks@example.com:IE',
      'nora.kelly@example.com:IE',
      'oliver.park@example.com:DE',
      'ravi.shah@example.com:GB',
      'sofia.martinez@example.com:GB',
      'tom.becker@example.com:GB',
    ])
  })

  it('seeds Alex incomplete and the recruiter-mock candidates complete, with their files on disk (OQ-4, P3-D11)', async () => {
    const profiles = await CandidateProfile.find().populate('userId', 'email phone')
    assert.equal(profiles.length, 7)
    const alex = profiles.find((profile) => profile.userId.email === demoAddress('alex'))
    assert.deepEqual(alex.completeness.toObject(), {
      done: 3,
      total: 11,
      complete: false,
      missing: ['work_history', 'languages', 'right_to_work', 'photo', 'links', 'phone', 'check_identity', 'check_academic'],
    })
    assert.deepEqual(alex.location.toObject(), PLACES.london)
    for (const profile of profiles.filter((p) => p !== alex)) {
      assert.deepEqual([profile.completeness.complete, profile.completeness.total], [true, 12], profile.userId.email)
      assert.match(profile.userId.phone.e164, /^\+4420794601\d\d$/)
    }
    const files = await File.find({ purpose: { $ne: 'kyc' } })
    // 7 CVs; 6 × (2 photo sizes + 3 evidence files)
    assert.equal(files.length, 7 + 6 * 5)
    assert.ok(files.every((file) => existsSync(absolutePath(file))), 'every file is on disk')
    assert.equal(await VerificationSubmission.countDocuments({ status: 'approved' }), 18)
    const evidence = files.find((file) => file.purpose === 'evidence')
    assert.ok(evidence.deleteAfter > new Date(), 'evidence is kept 30 days after the decision')
  })

  it('seeds approved companies with their jobs, the applicant and the recruiter-mock state (OQ-4, P4-C)', async () => {
    const companies = await Company.find().populate('ownerUserId', 'email status')
    assert.equal(companies.length, 11)
    const acme = companies.find((company) => company.displayName === 'Acme Studio')
    assert.deepEqual([acme.ownerUserId.email === demoAddress('sarah'), acme.location.toObject(), Boolean(acme.verifiedAt)], [true, PLACES.london, true])
    assert.equal(await PipelineStage.countDocuments({ companyId: acme._id }), 6)
    assert.equal(await PipelineStage.countDocuments(), 10 * 6)

    const jobs = await Job.find()
    assert.equal(jobs.length, 12)
    assert.ok(jobs.every((job) => job.status === 'published' && job.firstPublishedAt))
    assert.equal(jobs.filter((job) => String(job.companyId) === String(acme._id)).length, 3)
    // OQ-4: $110k–$140k in London = £83,000–£105,000; remote jobs are in EUR.
    const monzo = jobs.find((job) => job.title === 'Product Designer, Fintech')
    assert.deepEqual([monzo.country, monzo.salary.min, monzo.salary.max, monzo.salary.currency], ['GB', 83000, 105000, 'GBP'])
    assert.ok(jobs.filter((job) => job.country === 'REMOTE').every((job) => job.salary.currency === 'EUR' && !job.location?.placeId))
    assert.ok(jobs.some((job) => job.relevantCount > 0), 'relevant counts are computed')

    const applicant = companies.find((company) => company.ownerUserId.email === demoAddress('james'))
    assert.deepEqual([applicant.ownerUserId.status, applicant.location.countryCode, Boolean(applicant.submittedAt)], ['pending_review', 'IE', true])
    const kyc = await KycDocument.find({ companyId: applicant._id }).sort({ type: 1 })
    assert.deepEqual(kyc.map((document) => document.type), ['identity', 'registration'])
    const kycFiles = await File.find({ _id: { $in: kyc.map((document) => document.fileId) } })
    assert.ok(kycFiles.length === 2 && kycFiles.every((file) => existsSync(absolutePath(file))))

    assert.equal(await ShortlistEntry.countDocuments({ companyId: acme._id }), 2)
    const alex = await User.findOne({ email: demoAddress('alex') })
    assert.equal(await SavedJob.countDocuments({ candidateId: alex._id }), 2)
    const emma = await User.findOne({ email: demoAddress('emma') })
    const day = 24 * 60 * 60 * 1000
    assert.equal(await ProfileView.countDocuments({ candidateId: emma._id, at: { $gte: new Date(Date.now() - 30 * day) } }), 18)
    assert.equal(await ProfileView.countDocuments({ candidateId: emma._id, at: { $lt: new Date(Date.now() - 30 * day) } }), 16)
  })

  it('signs in Emma with SEED_PASSWORD', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: demoAddress('emma'), password: config.seed.password, portal: 'candidate' })
    assert.equal(res.status, 200)
    assert.equal(res.body.me.role, 'candidate')
    assert.equal(res.body.me.status, 'active')
    assert.equal(res.body.me.onboardingCompleted, true)
    assert.equal(res.body.me.plan, 'plus')
  })

  it('seeds payments and Emma’s real Plus subscription; re-seeding replaces this database’s Stripe customers (OD8, OQ-4.2, P5-Q3, P5-Q4)', async () => {
    const emma = await User.findOne({ email: demoAddress('emma') })
    const firstCustomer = emma.stripeCustomerId
    const customer = await stripe().customers.retrieve(firstCustomer)
    assert.deepEqual(customer.metadata, { db: 'eujobs_test', userId: String(emma._id), seed: 'true' })
    const subscription = await Subscription.findOne({ userId: emma._id })
    assert.deepEqual([subscription.status, subscription.currency, subscription.amountMinor, subscription.source], ['active', 'GBP', 900, 'seed'])

    const rows = await Payment.find({}).sort({ paidAt: 1 })
    // 3 mock course rows, 5 historical Plus months (every applicant but Emma), Emma's real first invoice.
    assert.equal(rows.length, 9)
    assert.deepEqual(
      rows.map((row) => row.reference),
      rows.map((_, index) => `LWM-${String(index + 1).padStart(6, '0')}`),
    )
    assert.ok(rows.every((row) => row.source === 'seed' && row.status === 'paid'))
    const emmaPlus = rows.at(-1)
    assert.deepEqual([String(emmaPlus.userId), emmaPlus.kind, emmaPlus.amountMinor, emmaPlus.currency], [String(emma._id), 'subscription', 900, 'GBP'])
    assert.match(emmaPlus.receiptUrl, /^https:\/\/invoice\.stripe\.com\//)
    assert.ok(rows.slice(0, -1).every((row) => !row.receiptUrl))
    const historical = rows.filter((row) => row.kind === 'subscription' && !row.stripe?.invoiceId)
    assert.deepEqual(historical.map((row) => `${row.payerName}:${row.amountMinor} ${row.currency}`).sort(), [
      'Aisha Patel:11900 SEK',
      'Daniel Kim:1000 EUR',
      'James Chen:1000 EUR',
      'Oliver Park:1000 EUR',
      'Sofia Martinez:900 GBP',
    ])
    assert.equal(await Subscription.countDocuments({}), 1)

    await seedDemo()
    assert.equal((await stripe().customers.retrieve(firstCustomer)).deleted, true)
    const again = await User.findOne({ email: demoAddress('emma') })
    assert.notEqual(again.stripeCustomerId, firstCustomer)
    assert.equal(await Payment.countDocuments({}), 9)
  })

  it('seeds the six pipeline placements as applications with coherent histories, and none for Alex (Phase 6, P6-Q1)', async () => {
    const applications = await Application.find().populate('candidateId', 'fullName email').populate('jobId', 'title')
    const placement = (application) => `${application.candidateId.fullName}: ${application.jobId.title}: ${application.status}`
    assert.deepEqual(applications.map(placement).sort(), [
      'Aisha Patel: Product Designer, Growth: applied',
      'Daniel Kim: Senior UX Designer: applied',
      'Emma Wilson: Senior Product Designer: under_review',
      'James Chen: Product Designer, Growth: under_review',
      'Oliver Park: Senior UX Designer: interview',
      'Sofia Martinez: Senior Product Designer: applied',
    ])
    assert.equal(await Application.countDocuments({ candidateId: (await User.findOne({ email: demoAddress('alex') }))._id }), 0)

    const stages = new Map((await PipelineStage.find()).map((stage) => [String(stage._id), stage]))
    for (const application of applications) {
      // OQ-4.2: everyone but Emma (a live subscriber) has one historical Plus month, paid before the application.
      const historical = await Payment.findOne({ userId: application.candidateId._id, kind: 'subscription', 'stripe.invoiceId': null })
      if (historical) assert.ok(application.appliedAt > historical.paidAt, `${application.candidateId.fullName} applied after paying`)
      else assert.equal(application.candidateId.fullName, 'Emma Wilson')
      assert.deepEqual(application.history.map((step) => step.stageName), application.history.map((step) => stages.get(String(step.stageId)).name))
      assert.equal(application.history[0].status, 'applied')
      assert.equal(application.history.at(-1).status, application.status)
      assert.equal(String(application.stageId), String(application.history.at(-1).stageId))
      assert.equal(application.lastEmailedStatus, application.status)
      assert.ok(application.history.every((step, index, all) => index === 0 || step.at > all[index - 1].at))
      assert.ok(application.history.at(-1).at < new Date())
    }
    const oliver = applications.find((application) => application.candidateId.fullName === 'Oliver Park')
    assert.deepEqual(oliver.history.map((step) => step.stageName), ['Applied', 'Screening', 'Shortlisted', 'Interview'])
    assert.equal(await RecruiterActivity.countDocuments({ type: 'applied' }), 6)
    assert.equal(await RecruiterActivity.countDocuments({ type: 'stage_changed' }), 6)
  })
})
