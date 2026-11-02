import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import { config } from '../config/env.js'
import { absolutePath } from '../lib/files.js'
import { AdminRole, Permission } from '../modules/admin/admin.model.js'
import { PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { ProfileView, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { File } from '../modules/files/files.model.js'
import { Country, Faq, LegalDocument } from '../modules/meta/meta.model.js'
import { Plan } from '../modules/payments/payments.model.js'
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
  })
})
