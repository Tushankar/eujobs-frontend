import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { capturedMail } from '../lib/mailer.js'
import { LoginEvent } from '../modules/auth/auth.model.js'
import { parseUserAgent } from '../lib/userAgent.js'
import { User } from '../modules/users/users.model.js'
import { api, createUser, PASSWORD, useTestDb } from './helpers/index.js'

useTestDb([User, LoginEvent])

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
// trust proxy is 'loopback', so the test client's X-Forwarded-For is the client IP.
const UK_IP = '81.2.69.160'

const signIn = (user, ua = CHROME_WINDOWS, password = PASSWORD) =>
  api().post('/api/v1/auth/login').set('User-Agent', ua).set('X-Forwarded-For', UK_IP).send({ email: user.email, password, portal: user.role })
const bearer = (token) => ({ Authorization: `Bearer ${token}` })
const list = (token) => api().get('/api/v1/me/sessions').set(bearer(token))

describe('parseUserAgent', () => {
  it('names browser, OS and device type', () => {
    assert.deepEqual(parseUserAgent(CHROME_WINDOWS), { browser: 'Chrome', browserVersion: '131', os: 'Windows', deviceType: 'desktop' })
    assert.deepEqual(parseUserAgent(SAFARI_IPHONE), { browser: 'Safari', browserVersion: '18', os: 'iOS', deviceType: 'mobile' })
    assert.equal(parseUserAgent(`${CHROME_WINDOWS} Edg/131.0.0.0`).browser, 'Edge')
    assert.deepEqual(parseUserAgent(''), { browser: null, browserVersion: null, os: null, deviceType: 'desktop' })
  })
})

describe('devices and sign-in history', () => {
  it('records sign-ins with device and place, and failed attempts', async () => {
    const user = await createUser()
    assert.equal((await signIn(user, CHROME_WINDOWS, 'Wrong-Password-1')).status, 401)
    const { token } = (await signIn(user)).body
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

  it('emails on a new device only, never on the first sign-in or a known device', async () => {
    const user = await createUser()
    await signIn(user)
    await signIn(user)
    assert.equal(capturedMail.filter((mail) => mail.type === 'new_device_sign_in').length, 0)
    await signIn(user, SAFARI_IPHONE)
    const mails = capturedMail.filter((mail) => mail.type === 'new_device_sign_in')
    assert.equal(mails.length, 1)
    assert.equal(mails[0].params.device, 'Safari on iOS')
    assert.match(mails[0].params.location, /United Kingdom/)
    assert.match(mails[0].params.link, /\/candidate\/settings\/data-account#devices$/)
  })

  it('signs out one other device, but not the current one through this route', async () => {
    const user = await createUser()
    const laptop = (await signIn(user)).body.token
    const phone = (await signIn(user, SAFARI_IPHONE)).body.token
    const { devices } = (await list(laptop)).body
    const phoneId = devices.find((device) => !device.current).id
    const currentId = devices.find((device) => device.current).id

    assert.equal((await api().delete(`/api/v1/me/sessions/${currentId}`).set(bearer(laptop))).status, 422)
    assert.equal((await api().delete(`/api/v1/me/sessions/${phoneId}`).set(bearer(laptop))).status, 204)
    assert.equal((await list(phone)).status, 401)
    assert.equal((await list(laptop)).body.devices.length, 1)
    assert.equal((await list(laptop)).body.history.find((row) => row.id === phoneId).status, 'signed_out')
    // Another account's session is not found.
    const other = await createUser()
    const otherToken = (await signIn(other)).body.token
    assert.equal((await api().delete(`/api/v1/me/sessions/${currentId}`).set(bearer(otherToken))).status, 404)
  })

  it('signs out every other device and gives this one a new token', async () => {
    const user = await createUser()
    const laptop = (await signIn(user)).body.token
    const phone = (await signIn(user, SAFARI_IPHONE)).body.token
    const res = await api().post('/api/v1/me/sessions/sign-out-others').set(bearer(laptop))
    assert.equal(res.status, 200)
    assert.equal((await list(phone)).status, 401)
    assert.equal((await list(laptop)).status, 401, 'the old token of this device carries the old tokenVersion')
    const after = (await list(res.body.token)).body
    assert.deepEqual(after.devices.map((device) => device.current), [true])
  })

  it('logout ends this session', async () => {
    const user = await createUser()
    const token = (await signIn(user)).body.token
    assert.equal((await api().post('/api/v1/auth/logout').set(bearer(token))).status, 204)
    assert.equal((await list(token)).status, 401)
  })
})
