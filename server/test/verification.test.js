import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { VerificationCode } from '../modules/auth/auth.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { File } from '../modules/files/files.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { image, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, mailTo, shiftBack, useTestDb, useTestUploads } from './helpers/index.js'

useTestDb([User, VerificationCode, VerificationSubmission, CandidateProfile, File, AuditEvent, AdminRole])
useTestUploads()
before(() => seedCatalog())

const DAY_MS = 24 * 60 * 60 * 1000
const phoneCode = (user, body) => api().post('/api/v1/candidate/verification/phone/code').set(auth(user)).send(body)
const phoneConfirm = (user, code) => api().post('/api/v1/candidate/verification/phone/confirm').set(auth(user)).send({ code })
/** Multipart with `file` (a passport JPG when omitted); `null` sends JSON with no file. */
const submit = async (user, fields, file) => {
  const req = api().post('/api/v1/candidate/verification/submissions').set(auth(user))
  if (file === null) return req.send(fields)
  const { buffer, name, type } = file ?? { buffer: await image('jpeg'), name: 'passport.jpg', type: 'image/jpeg' }
  return attach(req, buffer, name, type, fields)
}
const state = async (user) => (await api().get('/api/v1/candidate/verification').set(auth(user))).body
const check = (body, category) => body.checks.find((item) => item.category === category)
const decide = (admin, id, body) => api().post(`/api/v1/admin/moderation/verification/${id}/decision`).set(auth(admin)).send(body)
const wrongCode = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')

describe('phone verification (M-003, M-004, OD3)', () => {
  it('normalises a national number to E.164 and shows the code on screen', async () => {
    const user = await createUser()
    const res = await phoneCode(user, { phone: '512 345 678', country: 'PL' })
    assert.equal(res.status, 200)
    assert.equal(res.body.phone, '+48512345678')
    assert.match(res.body.code, /^\d{6}$/)
    assert.equal(res.body.expiresInSeconds, 600)
    assert.deepEqual((await phoneCode(user, { phone: '12', country: 'PL' })).body.error.fields, { phone: 'invalid' })
    const confirmed = await phoneConfirm(user, res.body.code)
    assert.deepEqual(confirmed.body.phone, { e164: '+48512345678', verified: true })
  })

  it('locks after 5 wrong codes and waits 60 s between codes', async () => {
    const user = await createUser()
    const { code } = (await phoneCode(user, { phone: '+44 20 7946 0123' })).body
    assert.equal((await phoneCode(user, { phone: '+44 20 7946 0123' })).body.error.code, 'RATE_LIMITED')
    for (let i = 4; i >= 1; i--) {
      const res = await phoneConfirm(user, wrongCode(code))
      assert.deepEqual([res.body.error.code, res.body.error.params.attemptsLeft], ['CODE_INVALID', i])
    }
    assert.equal((await phoneConfirm(user, wrongCode(code))).body.error.code, 'CODE_LOCKED')
    assert.equal((await phoneConfirm(user, code)).body.error.code, 'CODE_LOCKED')
  })

  it('verifies the same number on a second account, and a new number is unverified until confirmed', async () => {
    const first = await createUser()
    const second = await createUser()
    for (const user of [first, second]) {
      const { code } = (await phoneCode(user, { phone: '+442079460456' })).body
      assert.equal((await phoneConfirm(user, code)).body.phone.verified, true)
    }
    await shiftBack(VerificationCode, { userId: first._id }, 'sentAt', 61_000)
    await phoneCode(await User.findById(first._id), { phone: '+442079460789' })
    assert.deepEqual((await state(first)).phone, { e164: '+442079460789', verified: false })
  })
})

describe('evidence submissions (M-166, P3-D8)', () => {
  it('checks the evidence type, the linked entry and the file per category', async () => {
    const user = await createUser()
    const profile = await CandidateProfile.create({
      userId: user._id,
      education: [{ institution: 'UCL', degree: 'BSc', start: '2015-09', end: '2018-06' }],
      certificates: [{ name: 'Cert', issuer: 'Org', issuedOn: '2024-01' }],
      rightToWork: [{ region: 'eu', status: 'citizen_settled' }],
    })
    const education = String(profile.education[0]._id)
    const fields = async (...args) => (await submit(user, ...args)).body.error?.fields
    assert.deepEqual(await fields({ category: 'identity' }), { evidenceType: 'required' })
    assert.deepEqual(await fields({ category: 'academic', evidenceType: 'passport', entryId: education }), { evidenceType: 'invalid' })
    assert.deepEqual(await fields({ category: 'academic', evidenceType: 'diploma' }), { entryId: 'required' })
    assert.deepEqual(await fields({ category: 'identity', evidenceType: 'passport', entryId: education }), { entryId: 'not_allowed' })
    assert.deepEqual(await fields({ category: 'right_to_work', evidenceType: 'passport', entryId: String(profile.rightToWork[0]._id) }), { evidenceType: 'not_allowed' })
    assert.deepEqual(await fields({ category: 'certificate', entryId: String(profile.certificates[0]._id) }, null), { entryId: 'no_file' })
    assert.deepEqual(await fields({ category: 'identity', evidenceType: 'passport' }, null), { file: 'required' })
    const gif = await submit(user, { category: 'identity', evidenceType: 'passport' }, { buffer: await image('gif'), name: 'id.gif', type: 'image/gif' })
    assert.equal(gif.body.error.code, 'FILE_TYPE_NOT_ALLOWED')

    const academic = await submit(user, { category: 'academic', evidenceType: 'diploma', entryId: education }, { buffer: await textPdf('Diploma'), name: 'diploma.pdf', type: 'application/pdf' })
    assert.equal(academic.status, 201)
    assert.equal(check(academic.body, 'academic').status, 'in_review')
    assert.equal((await submit(user, { category: 'academic', evidenceType: 'transcript', entryId: education })).body.error.code, 'CONFLICT')
  })

  it('verifies a certificate from its own file', async () => {
    const user = await createUser()
    const file = await File.create({ ownerId: user._id, purpose: 'certificate_file', path: 'certificate_file/x.pdf', mime: 'application/pdf', size: 1 })
    const profile = await CandidateProfile.create({ userId: user._id, certificates: [{ name: 'Cert', issuer: 'Org', issuedOn: '2024-01', fileId: file._id }] })
    const res = await submit(user, { category: 'certificate', entryId: String(profile.certificates[0]._id) }, null)
    assert.equal(res.status, 201)
    assert.equal(res.body.certificates[0].status, 'in_review')
    assert.equal(String((await VerificationSubmission.findOne({ userId: user._id })).fileId), String(file._id))
  })

  it('needs identity always and academic or employment only with such an entry (M-023)', async () => {
    const user = await createUser()
    await CandidateProfile.create({ userId: user._id, workHistory: [{ title: 'Dev', employer: 'Co', start: '2020-01', current: true }] })
    const body = await state(user)
    assert.deepEqual(body.checks.map((item) => [item.category, item.required, item.status]), [
      ['identity', true, 'not_started'],
      ['academic', false, 'not_started'],
      ['employment', true, 'not_started'],
    ])
    assert.deepEqual([body.verified, body.verifiedCount, body.requiredCount], [false, 0, 2])
  })
})

describe('admin verification queue (M-166, M-092, M-162)', () => {
  it('lists the oldest first, rejects with a reason in the candidate language, then approves a resubmission', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const candidate = await createUser({ language: 'es', fullName: 'Lucía Gómez' })
    const other = await createUser()
    await submit(other, { category: 'identity', evidenceType: 'national_id' })
    await shiftBack(VerificationSubmission, { userId: other._id }, 'submittedAt', 60_000)
    await submit(candidate, { category: 'identity', evidenceType: 'passport' })

    const queue = await api().get('/api/v1/admin/moderation/verification').set(auth(owner))
    assert.deepEqual(queue.body.items.map((item) => item.candidate.email), [other.email, candidate.email])
    const id = queue.body.items[1].id
    const detail = await api().get(`/api/v1/admin/moderation/verification/${id}`).set(auth(owner))
    assert.deepEqual(detail.body.claim, { fullName: 'Lucía Gómez' })
    assert.deepEqual([detail.body.file.name, detail.body.file.mime], ['passport.jpg', 'image/jpeg'])

    assert.deepEqual((await decide(owner, id, { decision: 'rejected' })).body.error.fields, { reason: 'required' })
    assert.deepEqual((await decide(owner, id, { decision: 'rejected', reason: 'x'.repeat(301) })).body.error.fields, { reason: 'too_long' })
    const rejected = await decide(owner, id, { decision: 'rejected', reason: 'La foto no se lee.' })
    assert.deepEqual([rejected.body.status, rejected.body.reason, rejected.body.reviewedBy], ['rejected', 'La foto no se lee.', owner.fullName])
    assert.equal((await decide(owner, id, { decision: 'approved' })).body.error.code, 'CONFLICT')

    const [mail] = mailTo(candidate.email, 'verification_rejected')
    assert.equal(mail.language, 'es')
    assert.equal(mail.subject, 'Tu verificación de identidad necesita nueva documentación')
    assert.match(mail.text, /Motivo: La foto no se lee\./)
    assert.equal(check(await state(candidate), 'identity').status, 'rejected')
    const evidence = await File.findById((await VerificationSubmission.findById(id)).fileId)
    assert.ok(Math.abs(evidence.deleteAfter - Date.now() - 30 * DAY_MS) < 60_000, 'evidence deleted 30 days after the decision')

    await submit(candidate, { category: 'identity', evidenceType: 'passport' })
    const resubmitted = await VerificationSubmission.findOne({ userId: candidate._id, status: 'in_review' })
    assert.equal(String(resubmitted.previousSubmissionId), id)
    const approved = await decide(owner, String(resubmitted._id), { decision: 'approved' })
    assert.equal(approved.body.history[0].status, 'rejected')
    assert.equal(mailTo(candidate.email, 'verification_approved').length, 1)
    const me = await api().get('/api/v1/me').set(auth(candidate))
    assert.equal(me.body.completeness.items.find((item) => item.key === 'check_identity').done, true)

    const audit = await AuditEvent.find({ category: 'moderation' }).sort({ at: 1 })
    assert.deepEqual(audit.map((event) => event.type), ['moderation.verification_rejected', 'moderation.verification_approved'])
    assert.equal(audit[0].params.reason, 'La foto no se lee.')
    assert.equal(audit[0].actor.type, 'admin')
  })

  it('needs moderation.manage (M-155)', async () => {
    const role = await AdminRole.create({ name: 'Readers', nameLower: 'readers', permissions: ['documents.view'] })
    const reader = await createUser({ role: 'admin', adminAccess: { roleId: role._id } })
    const res = await api().get('/api/v1/admin/moderation/verification').set(auth(reader))
    assert.deepEqual([res.status, res.body.error], [403, { code: 'PERMISSION_DENIED', params: { permission: 'moderation.manage' } }])
    await role.deleteOne()
  })

  it('resets an approved check when its entry is edited and withdraws evidence when it is deleted (U27)', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const user = await createUser()
    const profile = await CandidateProfile.create({
      userId: user._id,
      education: [
        { institution: 'UCL', degree: 'BSc', start: '2015-09', end: '2018-06' },
        { institution: 'KCL', degree: 'MSc', start: '2018-09', end: '2019-09' },
      ],
    })
    const [first, second] = profile.education.map((entry) => String(entry._id))
    const pdf = async (name) => ({ buffer: await textPdf(name), name: `${name}.pdf`, type: 'application/pdf' })
    await submit(user, { category: 'academic', evidenceType: 'degree_certificate', entryId: first }, await pdf('bsc'))
    await submit(user, { category: 'academic', evidenceType: 'diploma', entryId: second }, await pdf('msc'))
    const firstSubmission = await VerificationSubmission.findOne({ entryId: first })
    await decide(owner, String(firstSubmission._id), { decision: 'approved' })
    assert.equal(check(await state(user), 'academic').status, 'approved')

    const edit = (id, body) => api().patch(`/api/v1/candidate/profile/education/${id}`).set(auth(user)).send(body)
    await edit(first, { institution: 'UCL', degree: 'BSc', start: '2015-09', end: '2018-06' })
    assert.equal(check(await state(user), 'academic').status, 'approved', 'an unchanged save keeps the approval')
    const changed = await edit(first, { institution: 'UCL', degree: 'BSc (Hons)', start: '2015-09', end: '2018-06' })
    assert.equal(changed.body.completeness.items.find((item) => item.key === 'check_academic').done, false)
    assert.equal(check(await state(user), 'academic').status, 'in_review')

    await api().delete(`/api/v1/candidate/profile/education/${second}`).set(auth(user))
    assert.equal(check(await state(user), 'academic').status, 'not_started')
    const queue = await api().get('/api/v1/admin/moderation/verification').set(auth(owner))
    assert.equal(queue.body.total, 0)
    // The entry can be verified again.
    assert.equal((await submit(user, { category: 'academic', evidenceType: 'diploma', entryId: first }, await pdf('again'))).status, 201)
  })
})
