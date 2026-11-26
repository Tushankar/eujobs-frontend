import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { config } from '../config/env.js'
import { absolutePath } from '../lib/files.js'
import { ScheduledTask } from '../jobs/models.js'
import { stripe } from '../lib/stripe.js'
import { AdminRole, Permission } from '../modules/admin/admin.model.js'
import { AgencyAgreement, AgencyClient, AgencyMembership, AgencyPlacement } from '../modules/agencies/agencies.model.js'
import { documentText } from '../modules/agencies/contracts.js'
import { phaseOf } from '../modules/agencies/lock.js'
import { JobAlert } from '../modules/alerts/alerts.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { ProfileView, RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { enforceFreeJobLimit } from '../modules/jobs/jobs.service.js'
import { Course, Enrollment } from '../modules/learning/learning.model.js'
import { File } from '../modules/files/files.model.js'
import { DocumentRequest, Interview } from '../modules/interviews/interviews.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Country, Faq, LegalDocument } from '../modules/meta/meta.model.js'
import { Payment, Plan, Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { addSectorJobs } from '../scripts/addSectorJobs.js'
import { seedCatalog } from '../seed/catalog.js'
import { AGENCIES } from '../seed/data/agencies.js'
import { EMPLOYERS, SECTOR_JOBS } from '../seed/data/employers.js'
import { FAQS } from '../seed/data/faqs.js'
import { LEGAL_VERSION } from '../seed/data/legal.js'
import { PLACES } from '../seed/data/places.js'
import { SECTORS } from '../seed/data/sectors.js'
import { demoAddress, seedDemo } from '../seed/demo.js'
import { api, finishLogin, mailTo, useTestDb, useTestUploads } from './helpers/index.js'

useTestDb()
useTestUploads()

const counts = async () => Promise.all([Country, Plan, Permission, AdminRole, Faq, LegalDocument].map((Model) => Model.countDocuments()))

describe('seed:catalog (U41)', () => {
  it('is idempotent: 245 countries (6 disabled), 6 plans, 24 permissions, 3 roles, the FAQs and 3 legal texts × 3 languages', async () => {
    await seedCatalog()
    const published = (await LegalDocument.findOne({ doc: 'terms', language: 'en' })).publishedAt
    await seedCatalog()
    assert.deepEqual(await counts(), [245, 6, 24, 3, FAQS.length, 9])
    assert.deepEqual((await LegalDocument.findOne({ doc: 'terms', language: 'en' })).publishedAt, published)
    assert.equal(await LegalDocument.countDocuments({ isDraft: true, version: LEGAL_VERSION }), 9)
  })

  it('stores currencies, default languages and OD1 prices', async () => {
    const country = async (code) => Country.findOne({ code }).lean()
    assert.equal((await country('BG')).currency, 'EUR')
    assert.equal((await country('HU')).currency, 'HUF')
    assert.equal((await country('GB')).currency, 'GBP')
    assert.deepEqual([(await country('REMOTE')).currency, (await country('REMOTE')).isRemote], ['EUR', true])
    assert.equal(await Country.countDocuments({ currency: 'EUR', isEu: true }), 21)
    assert.equal(await Country.countDocuments({ isEu: true }), 27)
    const languages = Object.fromEntries((await Country.find({ code: { $in: ['BE', 'ES', 'FR', 'LU', 'DE', 'MX', 'SN', 'US'] } })).map((c) => [c.code, c.defaultLanguage]))
    assert.deepEqual(languages, { BE: 'fr', DE: 'en', ES: 'es', FR: 'fr', LU: 'fr', MX: 'es', SN: 'fr', US: 'en' })
    assert.deepEqual((await Country.find({ enabled: false }).sort({ code: 1 })).map((c) => c.code), ['BY', 'CU', 'IR', 'KP', 'RU', 'SY'])
    const plus = await Plan.findOne({ key: 'plus' }).lean()
    assert.deepEqual(plus.entitlements, ['apply', 'message_send', 'job_alerts', 'ai'])
    assert.equal(plus.prices.find((price) => price.currency === 'HUF').amountMinor, 399000)
    assert.equal(plus.prices.length, 9)
    // P11c-Q2: Recruiter Plus, the £49 row, with its own Stripe prices.
    const recruiterPlus = await Plan.findOne({ key: 'recruiter_plus' }).lean()
    assert.deepEqual([recruiterPlus.role, recruiterPlus.name.fr, recruiterPlus.entitlements], ['recruiter', 'Recruiter Plus', ['jobs_unlimited', 'discovery', 'outreach', 'ai', 'interviews']])
    assert.deepEqual(
      recruiterPlus.prices.map((price) => `${price.currency} ${price.amountMinor / 100}`),
      ['GBP 49', 'EUR 57', 'PLN 245', 'SEK 629', 'DKK 429', 'CZK 1399', 'HUF 21990', 'RON 289', 'USD 65'],
    )
    assert.ok(recruiterPlus.prices.every((price) => price.stripePriceId?.startsWith('price_') && !plus.prices.some((other) => other.stripePriceId === price.stripePriceId)))
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

  it('recreates the Owner and the 5 demo accounts on plus-aliases, the same each run', async () => {
    await seedCatalog()
    await seedDemo()
    const first = await snapshot()
    await seedDemo()
    // Compared without printing: the addresses derive from SEED_ADMIN_EMAIL.
    assert.ok(JSON.stringify(await snapshot()) === JSON.stringify(first), 'the second run gives the same accounts')
    // The Owner, 5 demo accounts, the 5 recruiter-mock candidates, 9 mock-company and 45 sector-employer recruiters and
    // Atlas Interim's contact on example.com (§3.20, 2026-11-26).
    assert.equal(first.length, 66)

    const owner = first.find((user) => user.isOwner)
    assert.ok(owner.email === config.seed.adminEmail && owner.role === 'admin', 'Owner uses SEED_ADMIN_EMAIL')
    const expected = { alex: 'candidate:active:GB', emma: 'candidate:active:GB', sarah: 'recruiter:active:GB', james: 'recruiter:pending_review:IE', priya: 'agency:active:GB' }
    for (const [tag, state] of Object.entries(expected)) {
      const user = first.find((u) => u.email === demoAddress(tag))
      assert.ok(user, `+${tag} alias exists`)
      assert.equal(`${user.role}:${user.status}:${user.pickerCountry}`, state)
    }
    // The recruiter-mock people and recruiters on example.com (§3.20), plus each sector employer's recruiter and Atlas
    // Interim's contact (2026-11-26), every one in their city's country.
    const exampleCom = new Map(first.filter((user) => user.email.endsWith('@example.com')).map((user) => [user.email, user.pickerCountry]))
    const mock = {
      'aisha.patel@example.com': 'SE',
      'camille.martin@example.com': 'FR',
      'daniel.kim@example.com': 'FR',
      'erik.lund@example.com': 'SE',
      'ines.costa@example.com': 'PT',
      'james.chen@example.com': 'NL',
      'lena.fischer@example.com': 'DE',
      'lucas.meyer@example.com': 'NL',
      'maya.brooks@example.com': 'IE',
      'nora.kelly@example.com': 'IE',
      'oliver.park@example.com': 'DE',
      'ravi.shah@example.com': 'GB',
      'sofia.martinez@example.com': 'GB',
      'tom.becker@example.com': 'GB',
    }
    for (const [email, country] of Object.entries(mock)) assert.equal(exampleCom.get(email), country, email)
    const sectorPeople = [...EMPLOYERS, ...AGENCIES].filter((company) => company.recruiter.email)
    for (const company of sectorPeople) assert.equal(exampleCom.get(company.recruiter.email), PLACES[company.city].countryCode, company.recruiter.email)
    assert.equal(exampleCom.size, 14 + 46)
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
    const files = await File.find({ purpose: { $in: ['cv', 'photo', 'evidence'] } })
    // 7 CVs; 6 × (2 photo sizes + 3 evidence files)
    assert.equal(files.length, 7 + 6 * 5)
    assert.ok(files.every((file) => existsSync(absolutePath(file))), 'every file is on disk')
    assert.equal(await VerificationSubmission.countDocuments({ status: 'approved' }), 18)
    const evidence = files.find((file) => file.purpose === 'evidence')
    assert.ok(evidence.deleteAfter > new Date(), 'evidence is kept 30 days after the decision')
  })

  it('seeds approved companies with their jobs, the applicant and the recruiter-mock state (OQ-4, P4-C)', async () => {
    const companies = await Company.find().populate('ownerUserId', 'email status')
    // 10 mock companies, 45 sector employers, 2 agencies and the applicant (2026-11-26)
    assert.equal(companies.length, 58)
    const acme = companies.find((company) => company.displayName === 'Acme Studio')
    assert.deepEqual([acme.ownerUserId.email === demoAddress('sarah'), acme.location.toObject(), Boolean(acme.verifiedAt)], [true, PLACES.london, true])
    assert.equal(await PipelineStage.countDocuments({ companyId: acme._id }), 6)
    assert.equal(await PipelineStage.countDocuments(), 57 * 6)
    assert.ok(companies.filter((company) => company.ownerUserId.status === 'active').every((company) => company.sector && company.logoFileId), 'every approved company has a sector and a logo')

    const jobs = await Job.find()
    assert.equal(jobs.length, 71)
    assert.ok(jobs.every((job) => job.firstPublishedAt))
    // The two filled agency jobs (their placements are running) are closed; every other job is open.
    assert.deepEqual(jobs.filter((job) => job.status !== 'published').map((job) => `${job.title}:${job.status}`).sort(), ['Interim Lead Product Designer:closed', 'Interim UX Researcher:closed'])
    assert.equal(jobs.filter((job) => String(job.companyId) === String(acme._id)).length, 4)
    // OQ-4: $110k–$140k in London = £83,000–£105,000; remote company jobs are in EUR.
    const monzo = jobs.find((job) => job.title === 'Product Designer, Fintech')
    assert.deepEqual([monzo.country, monzo.salary.min, monzo.salary.max, monzo.salary.currency], ['GB', 83000, 105000, 'GBP'])
    assert.ok(jobs.filter((job) => job.country === 'REMOTE').every((job) => !job.location?.placeId && (job.agency || job.salary.currency === 'EUR')))
    // 2026-11-26: every sector has at least three open jobs, and every job type is there.
    const open = jobs.filter((job) => job.status === 'published')
    for (const sector of SECTORS) assert.ok(open.filter((job) => job.sector === sector.key).length >= 3, `${sector.key} has 3 open jobs`)
    assert.deepEqual([...new Set(open.map((job) => job.employmentType))].sort(), ['contract', 'full_time', 'internship', 'part_time', 'volunteer'])
    assert.ok(open.filter((job) => job.employmentType === 'volunteer').every((job) => !job.salary?.period))
    // Without Recruiter or Agency Plus a company keeps one live job (P11c-Q12): the check the server runs at start pauses none.
    await enforceFreeJobLimit()
    assert.equal(await Job.countDocuments({ status: 'paused' }), 0, 'the Free-plan job limit pauses no seeded job')
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
    const res = await finishLogin(
      await api().post('/api/v1/auth/login').send({ email: demoAddress('emma'), password: config.seed.password, portal: 'candidate' }),
    )
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
    // 3 mock course rows, 5 historical Plus months (every applicant but Emma), Emma's and Sarah's real first invoices (P11c-Q11)
    // and the two agencies' Agency Plus first invoices (2026-11-26).
    assert.equal(rows.length, 12)
    assert.deepEqual(
      rows.map((row) => row.reference),
      rows.map((_, index) => `EUJ-${String(index + 1).padStart(6, '0')}`),
    )
    assert.ok(rows.every((row) => row.source === 'seed' && row.status === 'paid'))
    const sarah = await User.findOne({ email: demoAddress('sarah') })
    const emmaPlus = rows.find((row) => String(row.userId) === String(emma._id) && row.kind === 'subscription')
    assert.deepEqual([emmaPlus.kind, emmaPlus.itemId, emmaPlus.amountMinor, emmaPlus.currency], ['subscription', 'plus', 900, 'GBP'])
    const sarahPlus = rows.find((row) => String(row.userId) === String(sarah._id) && row.kind === 'subscription')
    assert.deepEqual([sarahPlus.payerRole, sarahPlus.itemId, sarahPlus.itemName, sarahPlus.amountMinor, sarahPlus.currency], ['recruiter', 'recruiter_plus', 'Recruiter Plus', 4900, 'GBP'])
    for (const row of [emmaPlus, sarahPlus]) assert.match(row.receiptUrl, /^https:\/\/invoice\.stripe\.com\//)
    assert.equal(rows.filter((row) => row.receiptUrl).length, 4)
    const sarahSubscription = await Subscription.findOne({ userId: sarah._id })
    assert.deepEqual(
      [sarahSubscription.planKey, sarahSubscription.status, sarahSubscription.currency, sarahSubscription.amountMinor, sarahSubscription.source],
      ['recruiter_plus', 'active', 'GBP', 4900, 'seed'],
    )
    const historical = rows.filter((row) => row.kind === 'subscription' && !row.stripe?.invoiceId)
    assert.deepEqual(historical.map((row) => `${row.payerName}:${row.amountMinor} ${row.currency}`).sort(), [
      'Aisha Patel:11900 SEK',
      'Daniel Kim:1000 EUR',
      'James Chen:1000 EUR',
      'Oliver Park:1000 EUR',
      'Sofia Martinez:900 GBP',
    ])
    assert.equal(await Subscription.countDocuments({}), 4)

    await seedDemo()
    assert.equal((await stripe().customers.retrieve(firstCustomer)).deleted, true)
    const again = await User.findOne({ email: demoAddress('emma') })
    assert.notEqual(again.stripeCustomerId, firstCustomer)
    assert.equal(await Payment.countDocuments({}), 12)
  })

  it('seeds the six pipeline placements and the four agency hires as applications with coherent histories, and none for Alex (Phase 6, P6-Q1)', async () => {
    const applications = await Application.find().populate('candidateId', 'fullName email').populate('jobId', 'title')
    const placement = (application) => `${application.candidateId.fullName}: ${application.jobId.title}: ${application.status}`
    assert.deepEqual(applications.map(placement).sort(), [
      'Aisha Patel: Product Designer, Growth: applied',
      'Daniel Kim: Contract Interaction Designer: hired',
      'Daniel Kim: Senior UX Designer: applied',
      'Emma Wilson: Contract Senior Product Designer: hired',
      // P11d-Q30: Emma's seeded interview booking moved her to Interview.
      'Emma Wilson: Senior Product Designer: interview',
      'James Chen: Product Designer, Growth: under_review',
      'Oliver Park: Interim Lead Product Designer: hired',
      'Oliver Park: Senior UX Designer: interview',
      'Sofia Martinez: Interim UX Researcher: hired',
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
    const oliverAtAcme = applications.find((application) => application.candidateId.fullName === 'Oliver Park' && application.status === 'interview')
    assert.deepEqual(oliverAtAcme.history.map((step) => step.stageName), ['Applied', 'Screening', 'Shortlisted', 'Interview'])
    // Acme's 6 (1 + 7 moves) and the agencies' 4 (13 moves, made by the agency: the recruiter side).
    assert.equal(await RecruiterActivity.countDocuments({ type: 'applied' }), 10)
    assert.equal(await RecruiterActivity.countDocuments({ type: 'stage_changed' }), 20)
    const emma = applications.find((application) => application.candidateId.fullName === 'Emma Wilson' && application.status === 'interview')
    assert.deepEqual(emma.history.map((step) => step.stageName), ['Applied', 'Screening', 'Interview'])
    const hired = applications.filter((application) => application.status === 'hired')
    assert.ok(hired.every((application) => application.history.slice(1).every((step) => step.actorType === 'recruiter')))
  })

  it('seeds two approved agencies with clients, a published agreement, books, and a running and an upcoming placement each (2026-11-26)', async () => {
    const agencies = await User.find({ role: 'agency' }).sort({ fullName: 1 })
    assert.deepEqual(agencies.map((user) => `${user.fullName}:${user.status}`), ['Jonas Weber:active', 'Priya Nair:active'])
    assert.equal(agencies[1].email, demoAddress('priya'))
    for (const user of agencies) {
      const company = await Company.findOne({ ownerUserId: user._id })
      assert.ok(company.verifiedAt && company.logoFileId)
      const clients = await AgencyClient.find({ companyId: company._id })
      assert.equal(clients.length, 4)
      assert.ok(clients.every((client) => client.logoFileId && client.sector && client.industry))
      assert.equal(clients.filter((client) => client.linkedCompanyId).length, company.displayName === 'Atlas Interim' ? 2 : 1)

      const [agreement] = await AgencyAgreement.find({ companyId: company._id })
      assert.equal(agreement.status, 'published')
      const text = await documentText(agreement.file.fileId)
      for (const name of ['exclusivity', 'noticeDays', 'coolingOffDays', 'maxWeeklyHours']) {
        const clause = agreement.rules[name]?.clause
        if (clause) assert.ok(text.replace(/\s+/g, ' ').includes(clause), `${company.displayName} PDF quotes the ${name} clause`)
      }

      const jobs = await Job.find({ companyId: company._id })
      assert.ok(jobs.every((job) => job.agency.clientId && job.agency.startDate < job.agency.endDate && job.agency.rate.amountMinor > 0 && !job.salary?.period))
      assert.ok(jobs.some((job) => job.agency.showClient === false), 'a confidential client')
      assert.ok(jobs.every((job) => ['full_time', 'part_time'].includes(job.employmentType)))

      const placements = await AgencyPlacement.find({ companyId: company._id, status: 'confirmed' })
      assert.deepEqual(placements.map((placement) => phaseOf(placement)).sort(), ['running', 'upcoming'])
      assert.ok(placements.every((placement) => placement.agreementVersion === 1 && placement.sources.exclusivity === 'agreement' && placement.client.name))
      for (const placement of placements) {
        const membership = await AgencyMembership.findOne({ companyId: company._id, candidateId: placement.candidateId })
        assert.ok(membership.status === 'active' && membership.acceptances[0].at < placement.confirmedAt, 'agreed before being hired')
      }
    }
    const books = await AgencyMembership.find().populate('candidateId', 'fullName')
    assert.deepEqual(books.map((item) => `${item.candidateId.fullName}:${item.status}`).sort(), [
      'Aisha Patel:requested',
      'Daniel Kim:active',
      'Emma Wilson:active',
      'James Chen:awaiting_agreement',
      'Oliver Park:active',
      'Sofia Martinez:active',
    ])
  })

  it('scripts/addSectorJobs.js adds the sector data to a database seeded before it, once, and restores missing files (2026-11-26)', async () => {
    const models = [User, Company, Job, PipelineStage, AgencyClient, AgencyAgreement, AgencyMembership, AgencyPlacement, Application]
    const counts = () => Promise.all(models.map((Model) => Model.countDocuments()))
    const seeded = await counts()

    // The database as it was before 2026-11-26: no sector employers, agencies or new jobs of the mock companies.
    const users = await User.find({ email: { $in: [...EMPLOYERS, ...AGENCIES].map((company) => company.recruiter.email ?? demoAddress(company.recruiter.tag)) } })
    const companyIds = (await Company.find({ ownerUserId: { $in: users.map((user) => user._id) } })).map((company) => company._id)
    await Promise.all([
      Job.deleteMany({ $or: [{ companyId: { $in: companyIds } }, { title: { $in: SECTOR_JOBS.map((job) => job.title) } }] }),
      Application.deleteMany({ companyId: { $in: companyIds } }),
      PipelineStage.deleteMany({ companyId: { $in: companyIds } }),
      Company.deleteMany({ _id: { $in: companyIds } }),
      User.deleteMany({ _id: { $in: users.map((user) => user._id) } }),
      ...[AgencyClient, AgencyAgreement, AgencyMembership, AgencyPlacement].map((Model) => Model.deleteMany({})),
    ])
    assert.equal(await Job.countDocuments(), 12)

    // 45 employer recruiters and the 2 agency contacts; 46 company jobs and 13 agency jobs
    assert.deepEqual(await addSectorJobs(), { accounts: 47, jobs: 59 })
    assert.deepEqual(await counts(), seeded)
    assert.ok(await ScheduledTask.exists({ type: 'matching.recompute' }))
    // The two waiting events (Aisha's join request, James's invitation) get their bell notification once; nothing is emailed.
    const agencyNotifications = async () => (await Notification.find({ type: /^agency_/ })).map((item) => item.type).sort()
    assert.deepEqual(await agencyNotifications(), ['agency_invited', 'agency_join_requested'])
    assert.equal(mailTo(demoAddress('priya'), 'agency_update').length, 0)
    assert.deepEqual(await addSectorJobs(), { accounts: 0, jobs: 0 })
    assert.deepEqual(await counts(), seeded)
    assert.deepEqual(await agencyNotifications(), ['agency_invited', 'agency_join_requested'])

    // The other machine: the records are there, the files are not; the agreement comes back byte for byte.
    const agreement = await AgencyAgreement.findOne()
    const pdfFile = await File.findById(agreement.file.fileId)
    const logo = await File.findById((await Company.findOne({ displayName: 'Harbourview Health' })).logoFileId)
    await Promise.all([pdfFile, logo].map((file) => rm(absolutePath(file))))
    await addSectorJobs()
    assert.ok(existsSync(absolutePath(logo)))
    assert.equal(createHash('sha256').update(readFileSync(absolutePath(pdfFile))).digest('hex'), pdfFile.sha256)
  })

  it('seeds Emma’s booked interview and document request and Oliver’s pending offer, with their tasks (P11d-Q25, Q30)', async () => {
    const interviews = await Interview.find().populate('candidateId', 'fullName').sort({ status: 1 })
    assert.deepEqual(interviews.map((item) => [item.candidateId.fullName, item.status, item.mode, item.aiNotes, item.slots.length]), [
      ['Emma Wilson', 'confirmed', 'video', false, 3],
      ['Oliver Park', 'offered', 'video', true, 2],
    ])
    const [booked, offered] = interviews
    assert.ok(booked.startAt > new Date() && booked.confirmedAt < new Date())
    assert.ok(offered.slots.every((slot) => slot.startAt > new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)))
    const request = await DocumentRequest.findOne()
    assert.deepEqual([request.status, request.items.map((item) => item.kind)], ['open', ['id', 'right_to_work']])
    assert.deepEqual((await ScheduledTask.find({ type: /^interview./ })).map((task) => task.key.split(':')[0]).sort(), ['interview.close', 'interview.expire', 'interview.reminder', 'interview.reminder'])
    const events = await Message.find({ kind: { $ne: 'text' } }).sort({ createdAt: 1 })
    assert.deepEqual(events.map((message) => `${message.kind}.${message.event}`), ['interview.offered', 'interview.confirmed', 'document_request.created', 'interview.offered'])
    assert.ok(events.every((message) => message.readAt))
    assert.equal(await Notification.countDocuments({ type: /^(interview|document)/ }), 0)
  })

  it('seeds two Acme threads and Emma’s two alerts, with no email scheduled (P7-Q3, P7-Q4)', async () => {
    const sarah = await User.findOne({ email: demoAddress('sarah') })
    const emma = await User.findOne({ email: demoAddress('emma') })
    const conversations = await Conversation.find().populate('candidateId', 'fullName').populate('jobId', 'title')
    const summary = (conversation) => `${conversation.candidateId.fullName}: ${conversation.jobId.title}: ${conversation.unread.candidate}/${conversation.unread.recruiter}`
    assert.deepEqual(conversations.map(summary).sort(), ['Emma Wilson: Senior Product Designer: 0/1', 'Oliver Park: Senior UX Designer: 1/0'])
    assert.ok(conversations.every((conversation) => String(conversation.companyId) === String(sarah.companyId) && conversation.lastMessageAt < new Date()))
    assert.equal(await Message.countDocuments({ kind: 'text' }), 3)
    assert.equal(await RecruiterActivity.countDocuments({ type: 'outreach' }), 2)
    assert.equal(await RecruiterActivity.countDocuments({ type: 'message_reply' }), 1)
    assert.equal(await ScheduledTask.countDocuments({ type: 'email.message' }), 0)

    const alerts = await JobAlert.find().sort({ name: 1 })
    assert.deepEqual(
      alerts.map(({ candidateId, name, frequency, country, location }) => [String(candidateId), name, frequency, country, location]),
      [
        [String(emma._id), 'Remote product design roles', 'daily', 'REMOTE', null],
        [String(emma._id), 'Senior design roles in fintech', 'weekly', 'GB', null],
      ],
    )
  })

  it('seeds the 12 published courses with covers, 3 text lessons and 5 questions each, and the enrollments of the course payments (Phase 8, M-207, M-209)', async () => {
    const courses = await Course.find().sort({ audience: 1, title: 1 })
    assert.equal(courses.length, 12)
    assert.deepEqual([...new Set(courses.map((course) => course.audience))], ['candidate', 'recruiter'])
    for (const course of courses) {
      assert.equal(course.status, 'published')
      assert.equal(course.lessons.length, 3)
      assert.equal(course.quiz.questions.length, 5)
      assert.ok(course.quiz.questions.every((question) => question.correctOptionIds.length === 1))
      assert.equal(course.prices.length, 9)
      assert.ok(course.lessons.every((lesson) => lesson.textHtml.includes('<h2>') && lesson.durationSec >= 60))
      assert.ok(existsSync(absolutePath(await File.findById(course.coverFileId))))
    }
    const tech = courses.find((course) => course.title === 'Hiring Technology & Product Talent')
    assert.deepEqual([tech.pipelineCategory, tech.prices.find((price) => price.currency === 'HUF').amountMinor], ['screening', 2199000])

    const done = async (tag) => {
      const user = await User.findOne({ email: demoAddress(tag) })
      const enrollment = await Enrollment.findOne({ userId: user._id }).populate('courseId', 'title lockedAt')
      const payment = await Payment.findOne({ userId: user._id, kind: 'course' })
      assert.equal(payment.itemId, String(enrollment.courseId._id))
      assert.ok(enrollment.courseId.lockedAt)
      return [enrollment.courseId.title, enrollment.source, enrollment.lessons.filter((lesson) => lesson.completedAt).length]
    }
    assert.deepEqual(await done('alex'), ['Interaction design foundations', 'seed', 1])
    assert.deepEqual(await done('sarah'), ['Hiring Technology & Product Talent', 'seed', 1])
    assert.deepEqual(await done('emma'), ['Interaction systems in practice', 'seed', 0])
    assert.equal(await Enrollment.countDocuments(), 3)
  })
})
