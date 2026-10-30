import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AdminRole } from '../modules/admin/admin.model.js'
import { LegalDocument } from '../modules/meta/meta.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, PASSWORD, useTestDb } from './helpers/index.js'

useTestDb([User, LegalDocument])
before(() => seedCatalog())

const patchMe = (user, body) => api().patch('/api/v1/me').set(auth(user)).send(body)

describe('GET /me', () => {
  it('answers no token and a bad token with AUTH_REQUIRED', async () => {
    for (const headers of [{}, { Authorization: 'Bearer not-a-jwt' }]) {
      const res = await api().get('/api/v1/me').set(headers)
      assert.equal(res.status, 401)
      assert.deepEqual(res.body, { error: { code: 'AUTH_REQUIRED' } })
    }
  })

  it('returns the session profile per role', async () => {
    const candidate = await createUser()
    const res = await api().get('/api/v1/me').set(auth(candidate))
    assert.equal(res.status, 200)
    assert.equal(res.body.role, 'candidate')
    assert.equal(res.body.notifyEmail, true)
    assert.equal(res.body.onboardingCompleted, false)
    assert.equal(res.body.passwordHash, undefined)

    assert.equal(res.body.plan, 'free')

    const recruiter = await createUser({ role: 'recruiter', jobTitle: 'Talent lead', phone: { e164: '+442079460958' } })
    const recruiterMe = (await api().get('/api/v1/me').set(auth(recruiter))).body
    assert.equal(recruiterMe.jobTitle, 'Talent lead')
    assert.deepEqual(recruiterMe.phone, { e164: '+442079460958', verified: false })
    assert.equal(recruiterMe.plan, undefined)

    const admin = await createUser({ role: 'admin', isOwner: true })
    const adminMe = (await api().get('/api/v1/me').set(auth(admin))).body
    assert.equal(adminMe.isOwner, true)
    assert.equal(adminMe.permissions.length, 21)
    assert.equal(adminMe.adminRole, null)
    assert.equal(adminMe.notifyEmail, undefined)

    const staff = await createUser({ role: 'admin', adminAccess: { roleId: (await AdminRole.findOne({ name: 'Staff' }))._id } })
    const staffMe = (await api().get('/api/v1/me').set(auth(staff))).body
    assert.equal(staffMe.adminRole.name, 'Staff')
    assert.deepEqual(staffMe.permissions.sort(), ['candidates.view', 'users.view'])
  })
})

describe('PATCH /me (M-134, M-135)', () => {
  it('sets the language, and the country default follows until the choice is explicit', async () => {
    const user = await createUser({ language: 'en' })
    assert.equal((await patchMe(user, { pickerCountry: 'FR' })).body.language, 'fr')
    const explicit = await patchMe(user, { language: 'en', languageExplicit: true })
    assert.equal(explicit.body.language, 'en')
    const moved = await patchMe(user, { pickerCountry: 'ES' })
    assert.equal(moved.body.pickerCountry, 'ES')
    assert.equal(moved.body.language, 'en')
  })

  it('checks the country and the time zone', async () => {
    const user = await createUser()
    assert.deepEqual((await patchMe(user, { pickerCountry: 'US' })).body.error.fields, { pickerCountry: 'invalid' })
    assert.deepEqual((await patchMe(user, { timezone: 'Mars/Base' })).body.error.fields, { timezone: 'invalid' })
    const res = await patchMe(user, { timezone: 'Europe/Paris', fullName: 'Ana B. García', pickerCountry: 'remote' })
    assert.equal(res.status, 200)
    assert.equal(res.body.timezone, 'Europe/Paris')
    assert.equal(res.body.fullName, 'Ana B. García')
    assert.equal(res.body.pickerCountry, 'REMOTE')
  })

  it('gives admins no country picker (M-138)', async () => {
    const admin = await createUser({ role: 'admin' })
    assert.deepEqual((await patchMe(admin, { pickerCountry: 'DE' })).body.error.fields, { pickerCountry: 'not_allowed' })
  })
})

describe('POST /me/password (M-010)', () => {
  it('needs the current password, applies the rules and keeps other sessions', async () => {
    const user = await createUser()
    const change = (body) => api().post('/api/v1/me/password').set(auth(user)).send(body)
    assert.deepEqual((await change({ currentPassword: 'Wrong-Password-99', newPassword: 'Velvet-Orchard-36' })).body.error.fields, {
      currentPassword: 'invalid',
    })
    assert.deepEqual((await change({ currentPassword: PASSWORD, newPassword: 'password' })).body.error.fields, { newPassword: 'too_common' })
    assert.equal((await change({ currentPassword: PASSWORD, newPassword: 'Velvet-Orchard-36' })).status, 204)
    const login = await api().post('/api/v1/auth/login').send({ email: user.email, password: 'Velvet-Orchard-36', portal: 'candidate' })
    assert.equal(login.status, 200)
    assert.equal((await api().get('/api/v1/me').set(auth(user))).status, 200)
  })
})

describe('PATCH /me/notifications (M-095, OD6)', () => {
  it('turns the email toggle off for candidates and recruiters, not admins', async () => {
    const candidate = await createUser()
    const res = await api().patch('/api/v1/me/notifications').set(auth(candidate)).send({ notifyEmail: false })
    assert.equal(res.body.notifyEmail, false)
    const admin = await createUser({ role: 'admin' })
    const denied = await api().patch('/api/v1/me/notifications').set(auth(admin)).send({ notifyEmail: false })
    assert.equal(denied.status, 403)
    assert.equal(denied.body.error.code, 'FORBIDDEN')
  })
})

describe('POST /me/legal/accept (M-191, U22)', () => {
  it('records the current versions and clears the re-accept flag', async () => {
    const user = await createUser()
    for (const doc of ['terms', 'privacy']) {
      await LegalDocument.create({ doc, version: 'v-test', language: 'en', title: doc, publishedAt: new Date() })
    }
    assert.equal((await api().get('/api/v1/me').set(auth(user))).body.legal.acceptRequired, true)
    const res = await api().post('/api/v1/me/legal/accept').set(auth(user))
    assert.equal(res.status, 200)
    assert.equal(res.body.legal.termsVersion, 'v-test')
    assert.equal(res.body.legal.privacyVersion, 'v-test')
    assert.equal(res.body.legal.acceptRequired, false)
  })
})
