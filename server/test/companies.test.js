import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, describe, it } from 'node:test'
import { absolutePath } from '../lib/files.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { PipelineStage } from '../modules/applications/applications.model.js'
import { VerificationCode } from '../modules/auth/auth.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { image, MB, padded, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([User, Company, KycDocument, PipelineStage, VerificationCode, File, AuditEvent, AdminRole])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())

const COMPANY = {
  legalName: 'Nordlicht Studio GmbH',
  website: 'nordlicht.example',
  businessEmail: 'hello@nordlicht.example',
  industry: 'Design services',
  size: '11_50',
  placeId: PLACES.berlin.placeId,
  businessAddress: 'Torstraße 1, 10119 Berlin',
}
const onboarding = (user) => api().get('/api/v1/recruiter/onboarding').set(auth(user))
const saveCompany = (user, body = COMPANY) => api().put('/api/v1/recruiter/onboarding/company').set(auth(user)).send(body)
const uploadKyc = async (user, type, file) => {
  const { buffer, name, mime } = file ?? { buffer: await textPdf('Identity document'), name: `${type}.pdf`, mime: 'application/pdf' }
  return attach(api().post('/api/v1/recruiter/onboarding/documents').set(auth(user)), buffer, name, mime, { type })
}
const verifyPhone = async (user) => {
  const { code } = (await api().post('/api/v1/recruiter/onboarding/phone/code').set(auth(user)).send({ phone: '+49 30 901820' })).body
  return api().post('/api/v1/recruiter/onboarding/phone/confirm').set(auth(user)).send({ code })
}
const decide = (admin, user, body) => api().post(`/api/v1/admin/moderation/accounts/${user._id}/decision`).set(auth(admin)).send(body)
const recruiter = (fields) => createUser({ role: 'recruiter', status: 'onboarding', jobTitle: 'Talent lead', phone: { e164: '+493090182000' }, ...fields })

/** A recruiter who finished every step and submitted. */
async function submitted(fields) {
  const user = await recruiter(fields)
  await saveCompany(user)
  await uploadKyc(user, 'identity')
  await uploadKyc(user, 'registration')
  await verifyPhone(user)
  const res = await api().post('/api/v1/recruiter/onboarding/submit').set(auth(user))
  assert.equal(res.status, 200)
  return User.findById(user._id)
}

describe('recruiter onboarding (M-151 … M-153, P4-D1 … D3)', () => {
  it('walks company → KYC → phone → submit, and the workspace stays closed', async () => {
    const user = await recruiter({ language: 'fr', languageExplicit: true })
    let state = (await onboarding(user)).body
    assert.deepEqual(state.steps, { account: true, company: false, kyc: false, verify: false })
    assert.equal(state.currentStep, 'company')

    const saved = await saveCompany(user)
    assert.equal(saved.status, 200)
    assert.equal(saved.body.company.website, 'https://nordlicht.example')
    assert.equal(saved.body.company.displayName, COMPANY.legalName)
    assert.deepEqual(saved.body.company.location, PLACES.berlin)
    // M-149, M-134: the company country becomes the header country; an explicit language is kept.
    const me = (await api().get('/api/v1/me').set(auth(user))).body
    assert.deepEqual([me.pickerCountry, me.language, me.company.displayName], ['DE', 'fr', COMPANY.legalName])

    await uploadKyc(user, 'identity')
    state = (await uploadKyc(user, 'registration', { buffer: await image('png'), name: 'registration.png', mime: 'image/png' })).body
    assert.equal(state.currentStep, 'verify')
    assert.deepEqual(state.documents.map((document) => document.type), ['identity', 'registration'])

    const blocked = await api().get('/api/v1/recruiter/company').set(auth(user))
    assert.deepEqual([blocked.status, blocked.body.error.code, blocked.body.error.params], [403, 'RECRUITER_NOT_APPROVED', { status: 'onboarding', step: 'verify' }])

    const incomplete = await api().post('/api/v1/recruiter/onboarding/submit').set(auth(user))
    assert.deepEqual([incomplete.body.error.code, incomplete.body.error.params.step], ['VALIDATION_FAILED', 'verify'])

    assert.equal((await verifyPhone(user)).body.steps.verify, true)
    const done = await api().post('/api/v1/recruiter/onboarding/submit').set(auth(user))
    assert.deepEqual([done.body.status, done.body.editable, done.body.currentStep], ['pending_review', false, 'review'])
    assert.equal(await AuditEvent.countDocuments({ type: 'moderation.account_submitted' }), 1)
  })

  it('keeps the first step to details only; a new phone number is unverified (M-004)', async () => {
    const user = await recruiter({ phone: { e164: '+493090182000', verifiedAt: new Date() } })
    const res = await api().put('/api/v1/recruiter/onboarding/account').set(auth(user)).send({ fullName: 'Lena Vogel', jobTitle: 'Head of talent', phone: '030 901820', country: 'DE' })
    assert.deepEqual(res.body.account.phone, { e164: '+4930901820', verified: false })
    assert.equal(res.body.account.fullName, 'Lena Vogel')
    const same = await api().put('/api/v1/recruiter/onboarding/account').set(auth(user)).send({ fullName: 'Lena Vogel', jobTitle: 'Head of talent', phone: '+4930901820' })
    assert.equal(same.status, 200)
  })

  it('validates the company fields (P4-Q3)', async () => {
    const user = await recruiter()
    const res = await saveCompany(user, { ...COMPANY, legalName: 'A', website: 'http://nordlicht.example', businessAddress: 'x', size: 'huge' })
    assert.deepEqual(res.body.error.fields, { legalName: 'too_short', website: 'invalid', size: 'invalid', businessAddress: 'too_short' })
    const noDot = await saveCompany(user, { ...COMPANY, website: 'https://localhost' })
    assert.deepEqual(noDot.body.error.fields, { website: 'invalid' })
    // A city outside EU 27 + UK cannot be the company city (M-149).
    const toronto = await saveCompany(user, { ...COMPANY, placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' })
    assert.deepEqual(toronto.body.error.fields, { placeId: 'not_allowed' })
  })

  it('applies the KYC upload rules and locks the files after submit (M-185)', async () => {
    const user = await recruiter()
    assert.deepEqual((await uploadKyc(user, 'identity')).body.error.fields, { company: 'required' })
    await saveCompany(user)
    const large = await uploadKyc(user, 'identity', { buffer: padded(await textPdf('x'), 11 * MB), name: 'big.pdf', mime: 'application/pdf' })
    assert.deepEqual([large.status, large.body.error.code], [413, 'FILE_TOO_LARGE'])
    const text = await uploadKyc(user, 'identity', { buffer: Buffer.from('plain text'), name: 'notes.txt', mime: 'text/plain' })
    assert.equal(text.body.error.code, 'FILE_TYPE_NOT_ALLOWED')
    // A second identity file replaces the first.
    await uploadKyc(user, 'identity')
    await uploadKyc(user, 'identity')
    assert.equal(await KycDocument.countDocuments({ userId: user._id, type: 'identity' }), 1)
    assert.equal(await File.countDocuments({ ownerId: user._id, purpose: 'kyc' }), 1)

    const pending = await submitted()
    const locked = await uploadKyc(pending, 'authorization')
    assert.deepEqual([locked.status, locked.body.error.code], [409, 'LOCKED'])
    const document = await KycDocument.findOne({ userId: pending._id })
    assert.equal((await api().delete(`/api/v1/recruiter/onboarding/documents/${document._id}`).set(auth(pending))).body.error.code, 'LOCKED')
  })

  it('keeps unverified recruiters out (U37)', async () => {
    const user = await recruiter({ status: 'unverified', emailVerifiedAt: null })
    assert.equal((await onboarding(user)).body.error.code, 'EMAIL_UNVERIFIED')
  })
})

describe('account review (M-165, OQ-2, P4-Q2, P4-D4)', () => {
  it('lists pending recruiters oldest first with counts, and shows the review detail', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const first = await submitted({ fullName: 'First Applicant' })
    const second = await submitted({ fullName: 'Second Applicant' })
    await Company.updateOne({ ownerUserId: second._id }, { submittedAt: new Date(Date.now() - 60_000) })
    const list = (await api().get('/api/v1/admin/moderation/accounts').set(auth(owner))).body
    assert.deepEqual(list.items.map((item) => item.fullName), ['Second Applicant', 'First Applicant'])
    assert.equal(list.counts.pending_review, 2)

    const detail = (await api().get(`/api/v1/admin/moderation/accounts/${first._id}`).set(auth(owner))).body
    assert.deepEqual([detail.emailVerified, detail.phone.verified, detail.company.legalName], [true, true, COMPANY.legalName])
    assert.deepEqual(detail.documents.map((document) => document.type), ['identity', 'registration'])
    assert.deepEqual(detail.actions, ['approved', 'rejected', 'suspended'])
    const file = await api().get(`/api/v1/admin/files/${detail.documents[0].fileId}`).set(auth(owner))
    assert.equal(file.status, 200)
  })

  it('approves: status, default stages in the recruiter language, email, audit and KYC retention', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const user = await submitted({ language: 'es', languageExplicit: true })
    const res = await decide(owner, user, { decision: 'approved' })
    assert.deepEqual([res.status, res.body.status, res.body.actions], [200, 'active', ['suspended']])
    const company = await Company.findOne({ ownerUserId: user._id })
    assert.ok(company.verifiedAt)
    const stages = await PipelineStage.find({ companyId: company._id }).sort({ order: 1 })
    assert.deepEqual(stages.map((stage) => [stage.name, stage.category]), [
      ['Candidatura', 'applied'],
      ['Cribado', 'screening'],
      ['Preselección', 'shortlisted'],
      ['Entrevista', 'interview'],
      ['Oferta', 'offer'],
      ['Contratación', 'hired'],
    ])
    assert.equal(mailTo(user.email, 'recruiter_approved')[0].language, 'es')
    assert.equal(await AuditEvent.countDocuments({ type: 'moderation.account_approved' }), 1)
    assert.ok((await File.findOne({ ownerId: user._id, purpose: 'kyc' })).deleteAfter > new Date(Date.now() + 29 * 24 * 3600 * 1000))
    assert.equal((await api().get('/api/v1/recruiter/company').set(auth(await User.findById(user._id)))).status, 200)
  })

  it('rejects with a reason, and the recruiter resubmits after editing (M-152)', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const user = await submitted()
    assert.deepEqual((await decide(owner, user, { decision: 'rejected' })).body.error.fields, { reason: 'required' })
    assert.equal((await decide(owner, user, { decision: 'rejected', reason: 'x'.repeat(301) })).body.error.fields.reason, 'too_long')
    await decide(owner, user, { decision: 'rejected', reason: 'The registration certificate is unreadable.' })
    assert.equal(mailTo(user.email, 'recruiter_rejected')[0].params.reason, 'The registration certificate is unreadable.')
    const rejected = await User.findById(user._id)
    let state = (await onboarding(rejected)).body
    assert.deepEqual([state.status, state.editable, state.decision.reason], ['rejected', true, 'The registration certificate is unreadable.'])
    assert.deepEqual((await decide(owner, rejected, { decision: 'approved' })).body.error.code, 'CONFLICT')

    await uploadKyc(rejected, 'registration', { buffer: await image('png'), name: 'registration.png', mime: 'image/png' })
    state = (await api().post('/api/v1/recruiter/onboarding/submit').set(auth(rejected))).body
    assert.equal(state.status, 'pending_review')
    assert.equal(await AuditEvent.countDocuments({ type: 'moderation.account_resubmitted' }), 1)
  })

  it('suspends with a reason (sign-out) and reactivates; both need users.deactivate', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const moderator = await createUser({ role: 'admin', adminAccess: { granted: ['moderation.manage'] } })
    const user = await submitted()
    await decide(owner, user, { decision: 'approved' })
    const active = await User.findById(user._id)

    const detail = (await api().get(`/api/v1/admin/moderation/accounts/${user._id}`).set(auth(moderator))).body
    assert.deepEqual(detail.actions, [])
    assert.equal((await decide(moderator, user, { decision: 'suspended', reason: 'Fraud report' })).body.error.code, 'PERMISSION_DENIED')

    const before = auth(active)
    await decide(owner, user, { decision: 'suspended', reason: 'Fraud report under review' })
    assert.equal((await api().get('/api/v1/me').set(before)).body.error.code, 'AUTH_REQUIRED')
    const suspended = await User.findById(user._id)
    assert.equal((await api().get('/api/v1/recruiter/company').set(auth(suspended))).body.error.code, 'ACCOUNT_SUSPENDED')
    assert.equal(mailTo(user.email, 'recruiter_suspended').length, 1)

    const suspendedList = (await api().get('/api/v1/admin/moderation/accounts?status=suspended').set(auth(owner))).body
    assert.deepEqual(suspendedList.items.map((item) => item.id), [String(user._id)])
    await decide(owner, user, { decision: 'approved' })
    assert.equal((await User.findById(user._id)).status, 'active')
    assert.equal(mailTo(user.email, 'recruiter_approved').length, 2)
    assert.equal(await AuditEvent.countDocuments({ type: 'moderation.account_reactivated' }), 1)
    // Stages are created on the first approval only.
    assert.equal(await PipelineStage.countDocuments({ companyId: suspended.companyId }), 6)
  })

  it('needs moderation.manage', async () => {
    const admin = await createUser({ role: 'admin', adminAccess: { granted: ['users.view'] } })
    const res = await api().get('/api/v1/admin/moderation/accounts').set(auth(admin))
    assert.deepEqual([res.status, res.body.error.code], [403, 'PERMISSION_DENIED'])
  })
})

describe('company page and logo (M-147, M-150)', () => {
  async function approved() {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const user = await submitted()
    await decide(owner, user, { decision: 'approved' })
    return User.findById(user._id)
  }

  it('edits the public fields only; the legal name stays as verified', async () => {
    const user = await approved()
    const body = { displayName: 'Nordlicht', industry: 'Product design', size: '51_200', placeId: PLACES.munich.placeId, website: 'https://nordlicht.example/about', description: 'We design calm software for busy teams.' }
    const res = await api().patch('/api/v1/recruiter/company').set(auth(user)).send({ ...body, legalName: 'Changed GmbH' })
    assert.equal(res.status, 200)
    assert.deepEqual([res.body.displayName, res.body.legalName, res.body.location.city], ['Nordlicht', COMPANY.legalName, 'Munich'])
    const short = await api().patch('/api/v1/recruiter/company').set(auth(user)).send({ ...body, description: 'Too short' })
    assert.deepEqual(short.body.error.fields, { description: 'too_short' })
  })

  it('stores PNG logos, sanitises SVG and refuses large files', async () => {
    const user = await approved()
    const logo = (buffer, name, mime) => attach(api().post('/api/v1/recruiter/company/logo').set(auth(user)), buffer, name, mime)
    const png = await logo(await image('png'), 'logo.png', 'image/png')
    assert.match(png.body.logoUrl, /^\/api\/v1\/files\//)

    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10" fill="#123" onclick="alert(3)"/></svg>'
    const res = await logo(Buffer.from(svg), 'logo.svg', 'image/svg+xml')
    assert.equal(res.status, 200)
    const stored = await File.findOne({ ownerId: user._id, purpose: 'company_logo' })
    const served = await readFile(absolutePath(stored), 'utf8')
    assert.doesNotMatch(served, /script|onload|onclick/i)
    assert.match(served, /<rect/)
    assert.equal(await File.countDocuments({ ownerId: user._id, purpose: 'company_logo' }), 1)
    const file = await api().get(res.body.logoUrl)
    assert.equal(file.headers['content-type'], 'image/svg+xml')

    const fake = await logo(Buffer.from('<html><body>not an svg</body></html>'), 'logo.svg', 'image/svg+xml')
    assert.equal(fake.body.error.code, 'FILE_TYPE_NOT_ALLOWED')
    const large = await logo(padded(await image('png'), 3 * MB), 'big.png', 'image/png')
    assert.equal(large.body.error.code, 'FILE_TOO_LARGE')
    const removed = await api().delete('/api/v1/recruiter/company/logo').set(auth(user))
    assert.equal(removed.body.logoUrl, null)
  })
})
