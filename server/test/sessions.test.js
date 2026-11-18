import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { capturedMail } from '../lib/mailer.js'
import { codeAt, currentStep } from '../lib/totp.js'
import { parseUserAgent } from '../lib/userAgent.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { LoginChallenge, LoginEvent, TrustedDevice, VerificationCode } from '../modules/auth/auth.model.js'
import { User } from '../modules/users/users.model.js'
import { api, auth, createUser, PASSWORD, useTestDb } from './helpers/index.js'

useTestDb([User, LoginEvent, LoginChallenge, TrustedDevice, VerificationCode, AuditEvent])

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
// trust proxy is 'loopback', so the test client's X-Forwarded-For is the client IP.
const UK_IP = '81.2.69.160'

const post = (path, body, ua = CHROME_WINDOWS) => api().post(`/api/v1${path}`).set('User-Agent', ua).set('X-Forwarded-For', UK_IP).send(body)
const login = (user, { ua, password = PASSWORD, deviceToken } = {}) => post('/auth/login', { email: user.email, password, portal: user.role, deviceToken }, ua)
const lastCode = (to) => capturedMail.findLast((mail) => mail.type === 'login_code' && mail.to === to)?.params.code
const verify = (res, code, ua) => post('/auth/login/verify', { challenge: res.body.verification.challenge, code }, ua)
const bearer = (token) => ({ Authorization: `Bearer ${token}` })
const list = (token) => api().get('/api/v1/me/sessions').set(bearer(token))

/** A full sign-in on a new browser through the emailed code: answers { token, deviceToken }. */
async function signIn(user, ua = CHROME_WINDOWS) {
  const res = await login(user, { ua })
  return (await verify(res, lastCode(user.email), ua)).body
}

/** An admin who already set the authenticator app up: answers the Base32 secret. */
async function adminWithApp(fields) {
  const admin = await createUser({ role: 'admin', ...fields })
  const res = await login(admin)
  const { secret } = (await post('/auth/login/setup', { challenge: res.body.verification.challenge })).body
  await verify(res, codeAt(secret))
  return { admin, secret }
}

describe('parseUserAgent', () => {
  it('names browser, OS and device type', () => {
    assert.deepEqual(parseUserAgent(CHROME_WINDOWS), { browser: 'Chrome', browserVersion: '131', os: 'Windows', deviceType: 'desktop' })
    assert.deepEqual(parseUserAgent(SAFARI_IPHONE), { browser: 'Safari', browserVersion: '18', os: 'iOS', deviceType: 'mobile' })
    assert.equal(parseUserAgent(`${CHROME_WINDOWS} Edg/131.0.0.0`).browser, 'Edge')
    assert.deepEqual(parseUserAgent(''), { browser: null, browserVersion: null, os: null, deviceType: 'desktop' })
  })
})

describe('sign-in code on a new browser (2026-11-18)', () => {
  it('asks for the emailed code, then remembers the browser', async () => {
    const user = await createUser()
    const first = await login(user)
    assert.equal(first.status, 200)
    assert.equal(first.body.token, undefined)
    assert.equal(first.body.verification.method, 'email')
    assert.equal(first.body.verification.email, user.email.replace(/^(.)[^@]*/, '$1•••'))
    const code = lastCode(user.email)
    assert.match(code, /^\d{6}$/)

    const wrong = await verify(first, code === '000000' ? '111111' : '000000')
    assert.equal(wrong.body.error.code, 'CODE_INVALID')
    const done = await verify(first, code)
    assert.equal(done.status, 200)
    assert.ok(done.body.token && done.body.deviceToken)
    assert.equal(done.body.me.role, 'candidate')
    assert.equal((await verify(first, code)).body.error.code, 'TOKEN_USED')

    // The remembered browser signs straight in; any other browser is asked again.
    const again = await login(user, { deviceToken: done.body.deviceToken })
    assert.ok(again.body.token)
    assert.equal((await login(user, { deviceToken: 'someone-elses-key' })).body.verification.method, 'email')
    // The emailed code already told the user, so no new-device alert.
    assert.equal(capturedMail.filter((mail) => mail.type === 'new_device_sign_in').length, 0)
  })

  it('forgets the browser when that device is signed out, and every browser after a password reset', async () => {
    const user = await createUser()
    const laptop = await signIn(user)
    const phone = await signIn(user, SAFARI_IPHONE)
    const phoneId = (await list(laptop.token)).body.devices.find((device) => !device.current).id
    await api().delete(`/api/v1/me/sessions/${phoneId}`).set(bearer(laptop.token))
    assert.ok((await login(user, { ua: SAFARI_IPHONE, deviceToken: phone.deviceToken })).body.verification, 'the phone is asked again')
    assert.ok((await login(user, { deviceToken: laptop.deviceToken })).body.token, 'the laptop is still remembered')

    await post('/auth/forgot-password', { email: user.email })
    const resetToken = new URL(capturedMail.findLast((mail) => mail.type === 'password_reset').params.link).searchParams.get('token')
    const reset = await post('/auth/reset-password', { token: resetToken, password: 'Copper-Meadow-71' })
    assert.ok(reset.body.deviceToken, 'the browser that reset the password is remembered')
    assert.ok((await login(user, { password: 'Copper-Meadow-71', deviceToken: laptop.deviceToken })).body.verification, 'older browsers are forgotten')
    assert.ok((await login(user, { password: 'Copper-Meadow-71', deviceToken: reset.body.deviceToken })).body.token)
  })

  it('remembers the browser that opened the verification link', async () => {
    const email = `fresh.${Date.now()}@inbox.localworkman.eu`
    await post('/auth/candidate/register', { fullName: 'Fresh Person', email, password: PASSWORD, acceptTerms: true, language: 'en', country: 'GB' })
    const token = new URL(capturedMail.findLast((mail) => mail.type === 'verify_email').params.link).searchParams.get('token')
    const verified = await post('/auth/verify-email', { token })
    assert.equal(verified.body.role, 'candidate')
    assert.ok((await post('/auth/login', { email, password: PASSWORD, portal: 'candidate', deviceToken: verified.body.deviceToken })).body.token)
  })
})

describe('authenticator app (2026-11-18)', () => {
  it('makes an admin set it up at sign-in, then asks for it every time', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await login(admin)
    assert.equal(res.body.verification.method, 'totp_setup')
    const setup = (await post('/auth/login/setup', { challenge: res.body.verification.challenge })).body
    assert.match(setup.secret, /^[A-Z2-7]{32}$/)
    assert.match(setup.qr, /^data:image\/png;base64,/)
    assert.equal((await verify(res, '000000')).body.error.code, 'CODE_INVALID')
    const done = await verify(res, codeAt(setup.secret))
    assert.ok(done.body.token)
    assert.equal(done.body.deviceToken, undefined, 'admins are never remembered')
    assert.equal(done.body.backupCodes.length, 10)
    assert.equal(done.body.me.twoFactor.enabled, true)

    // Next sign-in: the app code again. A code works once; a backup code works once.
    const next = await login(admin)
    assert.equal(next.body.verification.method, 'totp')
    const usedStep = (await User.findById(admin._id)).twoFactor.lastStep
    assert.equal((await verify(next, codeAt(setup.secret, usedStep))).body.error.code, 'CODE_INVALID', 'the setup code cannot be replayed')
    assert.ok((await verify(next, done.body.backupCodes[0].toUpperCase())).body.token)
    const third = await login(admin)
    assert.equal((await verify(third, done.body.backupCodes[0])).body.error.code, 'CODE_INVALID')
  })

  it('replaces the email code for a candidate who turns it on, and needs the password to turn it off', async () => {
    const user = await createUser()
    const { token } = await signIn(user)
    const { secret } = (await api().post('/api/v1/me/2fa/setup').set(bearer(token))).body
    assert.equal((await api().post('/api/v1/me/2fa/enable').set(bearer(token)).send({ code: '000000' })).status, 422)
    const enabled = await api().post('/api/v1/me/2fa/enable').set(bearer(token)).send({ code: codeAt(secret) })
    assert.equal(enabled.body.backupCodes.length, 10)

    const phone = await login(user, { ua: SAFARI_IPHONE })
    assert.equal(phone.body.verification.method, 'totp')
    // The step was used by the enable call, so the phone uses a backup code (and gets the new-device alert).
    const done = await verify(phone, enabled.body.backupCodes[1], SAFARI_IPHONE)
    assert.ok(done.body.token && done.body.deviceToken)
    assert.equal(capturedMail.filter((mail) => mail.type === 'new_device_sign_in').length, 1)

    assert.equal((await api().post('/api/v1/me/2fa/disable').set(bearer(token)).send({ password: 'Wrong-Password-9' })).status, 422)
    const off = await api().post('/api/v1/me/2fa/disable').set(bearer(token)).send({ password: PASSWORD })
    assert.equal(off.body.twoFactor.enabled, false)
  })

  it('locks a challenge after 5 wrong codes', async () => {
    const { admin } = await adminWithApp()
    const res = await login(admin)
    for (let i = 0; i < 4; i++) assert.equal((await verify(res, '000000')).body.error.code, 'CODE_INVALID')
    assert.equal((await verify(res, '000000')).body.error.code, 'CODE_LOCKED')
    assert.equal((await verify(res, '000000')).body.error.code, 'TOKEN_EXPIRED')
  })

  it('lets only the Owner reset another admin’s 2FA, which signs that admin out', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const { admin: staff, secret } = await adminWithApp()
    // The setup used this time step's code, so the next one (accepted for clock drift) signs in again.
    const staffSession = await verify(await login(staff), codeAt(secret, currentStep() + 1))
    assert.ok(staffSession.body.token)
    const reset = (actor) => api().post(`/api/v1/admin/access/users/${staff._id}/2fa/reset`).set(auth(actor))
    assert.equal((await reset(staff)).status, 403)
    const res = await reset(owner)
    assert.equal(res.status, 200)
    assert.equal(res.body.twoFactorEnabled, false)
    assert.equal((await list(staffSession.body.token)).status, 401)
    assert.equal((await login(staff)).body.verification.method, 'totp_setup')
    assert.ok(await AuditEvent.exists({ type: 'access.two_factor_reset' }))
  })
})

describe('devices and sign-in history', () => {
  it('records sign-ins with device and place, and failed attempts', async () => {
    const user = await createUser()
    assert.equal((await login(user, { password: 'Wrong-Password-1' })).status, 401)
    const { token } = await signIn(user)
    const res = await list(token)
    assert.equal(res.status, 200)
    assert.equal(res.body.devices.length, 1)
    const [device] = res.body.devices
    assert.equal(device.current, true)
    assert.deepEqual([device.browser, device.os, device.deviceType, device.ip, device.country], ['Chrome', 'Windows', 'desktop', UK_IP, 'GB'])
    assert.deepEqual(
      res.body.history.map((row) => row.status),
      ['active', 'failed'],
    )
  })

  it('signs out one other device, but not the current one through this route', async () => {
    const user = await createUser()
    const laptop = (await signIn(user)).token
    const phone = (await signIn(user, SAFARI_IPHONE)).token
    const { devices } = (await list(laptop)).body
    const phoneId = devices.find((device) => !device.current).id
    const currentId = devices.find((device) => device.current).id

    assert.equal((await api().delete(`/api/v1/me/sessions/${currentId}`).set(bearer(laptop))).status, 422)
    assert.equal((await api().delete(`/api/v1/me/sessions/${phoneId}`).set(bearer(laptop))).status, 204)
    assert.equal((await list(phone)).status, 401)
    assert.equal((await list(laptop)).body.devices.length, 1)
    assert.equal((await list(laptop)).body.history.find((row) => row.id === phoneId).status, 'signed_out')
    const other = await createUser()
    const otherToken = (await signIn(other)).token
    assert.equal((await api().delete(`/api/v1/me/sessions/${currentId}`).set(bearer(otherToken))).status, 404)
  })

  it('signs out every other device and gives this one a new token', async () => {
    const user = await createUser()
    const laptop = (await signIn(user)).token
    const phone = (await signIn(user, SAFARI_IPHONE)).token
    const res = await api().post('/api/v1/me/sessions/sign-out-others').set(bearer(laptop))
    assert.equal(res.status, 200)
    assert.equal((await list(phone)).status, 401)
    assert.equal((await list(laptop)).status, 401, 'the old token of this device carries the old tokenVersion')
    const after = (await list(res.body.token)).body
    assert.deepEqual(after.devices.map((device) => device.current), [true])
  })

  it('logout ends this session', async () => {
    const user = await createUser()
    const { token } = await signIn(user)
    assert.equal((await api().post('/api/v1/auth/logout').set(bearer(token))).status, 204)
    assert.equal((await list(token)).status, 401)
  })
})
