import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { dictionaries } from '../lib/i18n.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { EmailToken, VerificationCode } from '../modules/auth/auth.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, linkToken, mailTo, PASSWORD, shiftBack, testEmail, useTestDb } from './helpers/index.js'

useTestDb([User, EmailToken, VerificationCode, EmailLog])
before(() => seedCatalog())

const MINUTE = 60 * 1000
const candidate = (overrides = {}) => ({
  fullName: 'Ana García',
  email: testEmail('candidate'),
  password: PASSWORD,
  acceptTerms: true,
  language: 'en',
  country: 'ES',
  timezone: 'Europe/Madrid',
  ...overrides,
})
const recruiter = (overrides = {}) => ({
  ...candidate({ email: testEmail('recruiter'), country: 'GB' }),
  jobTitle: 'Talent lead',
  phone: '020 7946 0958',
  ...overrides,
})
const login = (email, password = PASSWORD, portal = 'candidate') => api().post('/api/v1/auth/login').send({ email, password, portal })

describe('candidate sign-up and the email link (M-001, U36)', () => {
  for (const language of ['en', 'es', 'fr']) {
    it(`returns 201 without a token and emails the link in ${language}`, async () => {
      const body = candidate({ language })
      const res = await api().post('/api/v1/auth/candidate/register').send(body)
      assert.equal(res.status, 201)
      assert.equal(res.body.token, undefined)
      const [mail] = mailTo(body.email, 'verify_email')
      assert.equal(mail.language, language)
      assert.equal(mail.subject, dictionaries[language].email.verify_email.subject)
      assert.ok(mail.params.link.includes('/verify-email?token='))
      const user = await User.findOne({ email: body.email })
      assert.equal(user.status, 'unverified')
      assert.equal(user.pickerCountry, 'ES')
    })
  }

  it('answers a duplicate the same way and emails "already registered"', async () => {
    const existing = await createUser()
    const res = await api().post('/api/v1/auth/candidate/register').send(candidate({ email: existing.email, language: 'fr' }))
    assert.equal(res.status, 201)
    assert.equal(await User.countDocuments({ email: existing.email }), 1)
    const [mail] = mailTo(existing.email, 'already_registered')
    assert.equal(mail.language, 'fr')
    assert.ok(mail.params.link.endsWith('/sign-in') && mail.params.secondaryLink.endsWith('/forgot-password'))
  })

  it('requires the consent checkbox and an enabled country', async () => {
    const res = await api().post('/api/v1/auth/candidate/register').send(candidate({ acceptTerms: false, country: 'US' }))
    assert.equal(res.status, 422)
    assert.equal(res.body.error.fields.acceptTerms, 'invalid')
    const res2 = await api().post('/api/v1/auth/candidate/register').send(candidate({ country: 'US' }))
    assert.deepEqual(res2.body.error.fields, { country: 'invalid' })
  })

  it('limits resends to 1 per minute and 5 per day', async () => {
    const body = candidate()
    await api().post('/api/v1/auth/candidate/register').send(body)
    const resend = () => api().post('/api/v1/auth/verify-email/resend').send({ email: body.email })
    assert.equal((await resend()).status, 202)
    assert.equal(mailTo(body.email).length, 1, 'no second email within a minute')
    for (let sent = 2; sent <= 5; sent++) {
      await shiftBack(EmailLog, { to: body.email }, 'createdAt', 2 * MINUTE)
      await resend()
      assert.equal(mailTo(body.email).length, sent)
    }
    await shiftBack(EmailLog, { to: body.email }, 'createdAt', 2 * MINUTE)
    assert.equal((await resend()).status, 202)
    assert.equal(mailTo(body.email).length, 5, 'no sixth email in 24 h')
  })

  it('answers a resend for an unknown address with 202 and sends nothing', async () => {
    const res = await api().post('/api/v1/auth/verify-email/resend').send({ email: testEmail('nobody') })
    assert.equal(res.status, 202)
    assert.equal(await EmailLog.countDocuments(), 0)
  })
})

describe('candidate sign-in (M-001, M-005)', () => {
  it('refuses an unverified login, accepts it after the link, then refuses link reuse', async () => {
    const body = candidate()
    await api().post('/api/v1/auth/candidate/register').send(body)
    const unverified = await login(body.email)
    assert.equal(unverified.status, 403)
    assert.equal(unverified.body.error.code, 'EMAIL_UNVERIFIED')

    const token = linkToken(body.email, 'verify_email')
    const verified = await api().post('/api/v1/auth/verify-email').send({ token })
    assert.equal(verified.status, 200)
    assert.deepEqual(verified.body, { role: 'candidate' })

    const res = await login(body.email)
    assert.equal(res.status, 200)
    assert.ok(res.body.token)
    assert.equal(res.body.me.status, 'active')
    assert.equal(res.body.me.onboardingCompleted, false)

    const reused = await api().post('/api/v1/auth/verify-email').send({ token })
    assert.equal(reused.status, 409)
    assert.equal(reused.body.error.code, 'TOKEN_USED')
  })

  it('answers an expired link with TOKEN_EXPIRED and an unknown one with TOKEN_INVALID', async () => {
    const body = candidate()
    await api().post('/api/v1/auth/candidate/register').send(body)
    await EmailToken.updateMany({}, { expiresAt: new Date(Date.now() - MINUTE) })
    const expired = await api().post('/api/v1/auth/verify-email').send({ token: linkToken(body.email, 'verify_email') })
    assert.equal(expired.status, 410)
    assert.equal(expired.body.error.code, 'TOKEN_EXPIRED')
    const unknown = await api().post('/api/v1/auth/verify-email').send({ token: 'not-a-real-token' })
    assert.equal(unknown.status, 400)
    assert.equal(unknown.body.error.code, 'TOKEN_INVALID')
  })

  it('signs a candidate in on the recruiter portal with role candidate', async () => {
    const user = await createUser()
    const res = await login(user.email, PASSWORD, 'recruiter')
    assert.equal(res.status, 200)
    assert.equal(res.body.me.role, 'candidate')
  })

  it('keeps the admin portal for admins only, and admins only there', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    assert.equal((await login(admin.email, PASSWORD, 'candidate')).body.error.code, 'INVALID_CREDENTIALS')
    assert.equal((await login(user.email, PASSWORD, 'admin')).body.error.code, 'INVALID_CREDENTIALS')
    assert.equal((await login(admin.email, PASSWORD, 'admin')).status, 200)
  })

  it('answers a wrong password and an unknown email with INVALID_CREDENTIALS', async () => {
    const user = await createUser()
    const wrong = await login(user.email, 'Wrong-Password-99')
    const unknown = await login(testEmail('nobody'))
    assert.equal(wrong.status, 401)
    assert.deepEqual(wrong.body, unknown.body)
    assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS')
  })

  it('saves the browser time zone at sign-in (U12)', async () => {
    const user = await createUser({ timezone: 'Europe/London' })
    await api().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD, portal: 'candidate', timezone: 'Europe/Warsaw' })
    assert.equal((await User.findById(user._id)).timezone, 'Europe/Warsaw')
  })
})

describe('recruiter sign-up and the email code (M-002, M-004, U37)', () => {
  async function registerRecruiter(body = recruiter()) {
    const res = await api().post('/api/v1/auth/recruiter/register').send(body)
    assert.equal(res.status, 201)
    return { body, token: res.body.token, me: res.body.me }
  }
  const code = (email) => mailTo(email, 'recruiter_email_code').at(-1).params.code
  const verify = (token, value) => api().post('/api/v1/auth/email-code/verify').set('Authorization', `Bearer ${token}`).send({ code: value })
  const resend = (token) => api().post('/api/v1/auth/email-code/resend').set('Authorization', `Bearer ${token}`)
  const wrongCode = (value) => String((Number(value) + 1) % 1e6).padStart(6, '0')

  it('returns a token, stores the phone in E.164 and blocks other endpoints until the code', async () => {
    const { token, me } = await registerRecruiter()
    assert.ok(token)
    assert.equal(me.status, 'unverified')
    assert.equal(me.phone.e164, '+442079460958')
    const meRes = await api().get('/api/v1/me').set('Authorization', `Bearer ${token}`)
    assert.equal(meRes.status, 200)
    const blocked = await api().patch('/api/v1/me/notifications').set('Authorization', `Bearer ${token}`).send({ notifyEmail: false })
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, 'EMAIL_UNVERIFIED')
  })

  it('locks the code after 5 wrong attempts', async () => {
    const { body, token } = await registerRecruiter()
    const right = code(body.email)
    for (let left = 4; left >= 1; left--) {
      const res = await verify(token, wrongCode(right))
      assert.equal(res.status, 422)
      assert.deepEqual(res.body.error, { code: 'CODE_INVALID', params: { attemptsLeft: left } })
    }
    const locked = await verify(token, wrongCode(right))
    assert.equal(locked.status, 429)
    assert.equal(locked.body.error.code, 'CODE_LOCKED')
    assert.equal((await verify(token, right)).body.error.code, 'CODE_LOCKED')
  })

  it('answers an expired code with CODE_EXPIRED', async () => {
    const { body, token } = await registerRecruiter()
    await VerificationCode.updateMany({}, { expiresAt: new Date(Date.now() - MINUTE) })
    const res = await verify(token, code(body.email))
    assert.equal(res.status, 410)
    assert.equal(res.body.error.code, 'CODE_EXPIRED')
  })

  it('limits resends (60 s, 5 per hour) and accepts the newest code', async () => {
    const { body, token } = await registerRecruiter()
    const early = await resend(token)
    assert.equal(early.status, 429)
    assert.equal(early.body.error.code, 'RATE_LIMITED')
    assert.ok(early.body.error.params.retryAfter > 0 && early.body.error.params.retryAfter <= 60)

    for (let sent = 2; sent <= 5; sent++) {
      await shiftBack(VerificationCode, {}, 'sentAt', MINUTE + 1000)
      assert.equal((await resend(token)).status, 202)
    }
    await shiftBack(VerificationCode, {}, 'sentAt', MINUTE + 1000)
    const sixth = await resend(token)
    assert.equal(sixth.status, 429)
    assert.ok(sixth.body.error.params.retryAfter > 60)

    const res = await verify(token, code(body.email))
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'onboarding')
    assert.equal(res.body.emailVerified, true)
  })

  it('answers a registered email with EMAIL_TAKEN', async () => {
    const existing = await createUser()
    const res = await api().post('/api/v1/auth/recruiter/register').send(recruiter({ email: existing.email }))
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'EMAIL_TAKEN')
  })

  it('rejects an invalid phone number', async () => {
    const res = await api().post('/api/v1/auth/recruiter/register').send(recruiter({ phone: '12' }))
    assert.equal(res.status, 422)
    assert.deepEqual(res.body.error.fields, { phone: 'invalid' })
  })
})

describe('password rules (M-006, U2)', () => {
  const cases = [
    ['7 characters', { password: 'Abc-123' }, 'too_short', { min: 8 }],
    ['a common password', { password: 'password' }, 'too_common', undefined],
    ['the email local part', { email: 'marie.curie.lwm@inbox.localworkman.eu', password: 'Marie.Curie.LWM' }, 'matches_email', undefined],
    ['more than 72 bytes', { password: 'é'.repeat(40) }, 'too_long', { maxBytes: 72 }],
  ]
  for (const [label, overrides, key, params] of cases) {
    it(`rejects ${label}`, async () => {
      const res = await api().post('/api/v1/auth/candidate/register').send(candidate(overrides))
      assert.equal(res.status, 422)
      assert.deepEqual(res.body.error, { code: 'VALIDATION_FAILED', fields: { password: key }, ...(params && { params }) })
    })
  }
})

describe('rate limits (M-008, U1)', () => {
  const fromIp = (request, ip) => request.set('X-Forwarded-For', ip)

  it('limits failed logins per email to 5 per 15 minutes', async () => {
    const user = await createUser()
    for (let i = 0; i < 5; i++) assert.equal((await login(user.email, 'Wrong-Password-99')).status, 401)
    const res = await login(user.email, PASSWORD)
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'RATE_LIMITED')
    assert.ok(res.body.error.params.retryAfter > 0)
  })

  it('does not count successful logins against the email', async () => {
    const user = await createUser()
    for (let i = 0; i < 6; i++) assert.equal((await login(user.email)).status, 200)
  })

  it('limits logins per IP to 20 per 15 minutes', async () => {
    const send = (ip) => fromIp(api().post('/api/v1/auth/login'), ip).send({ email: testEmail(), password: 'x', portal: 'candidate' })
    for (let i = 0; i < 20; i++) assert.equal((await send('203.0.113.7')).status, 401)
    assert.equal((await send('203.0.113.7')).body.error.code, 'RATE_LIMITED')
    assert.equal((await send('203.0.113.8')).status, 401)
  })

  it('limits forgot-password requests per email to 5 per hour', async () => {
    const email = testEmail()
    for (let i = 0; i < 5; i++) assert.equal((await api().post('/api/v1/auth/forgot-password').send({ email })).status, 202)
    const res = await api().post('/api/v1/auth/forgot-password').send({ email })
    assert.equal(res.body.error.code, 'RATE_LIMITED')
  })

  it('limits sign-ups per IP to 10 per hour', async () => {
    const send = (ip) => fromIp(api().post('/api/v1/auth/candidate/register'), ip).send({})
    for (let i = 0; i < 10; i++) assert.equal((await send('198.51.100.4')).status, 422)
    assert.equal((await send('198.51.100.4')).body.error.code, 'RATE_LIMITED')
    assert.equal((await send('198.51.100.5')).status, 422)
  })
})

describe('forgot and reset password (M-009)', () => {
  const forgot = (email) => api().post('/api/v1/auth/forgot-password').send({ email })
  const reset = (token, password) => api().post('/api/v1/auth/reset-password').send({ token, password })

  it('answers an unknown email with 202 and sends nothing', async () => {
    const email = testEmail('nobody')
    assert.equal((await forgot(email)).status, 202)
    assert.equal(mailTo(email).length, 0)
  })

  it('resets: signs out old sessions, verifies the email, returns the role', async () => {
    const user = await createUser({ role: 'recruiter', status: 'unverified', emailVerifiedAt: undefined })
    const oldSession = auth(user)
    assert.equal((await forgot(user.email)).status, 202)
    const token = linkToken(user.email, 'password_reset')

    const weak = await reset(token, 'password')
    assert.equal(weak.body.error.fields.password, 'too_common')

    const res = await reset(token, 'Copper-Meadow-71')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { role: 'recruiter' })
    const after = await User.findById(user._id)
    assert.equal(after.tokenVersion, 1)
    assert.ok(after.emailVerifiedAt)
    assert.equal(after.status, 'onboarding')

    const stale = await api().get('/api/v1/me').set(oldSession)
    assert.equal(stale.status, 401)
    assert.equal(stale.body.error.code, 'AUTH_REQUIRED')
    assert.equal((await login(user.email, 'Copper-Meadow-71', 'recruiter')).status, 200)
    assert.equal((await reset(token, 'Copper-Meadow-72')).body.error.code, 'TOKEN_USED')
  })
})
