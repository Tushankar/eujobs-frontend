import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { capturedMail, sendEmail } from '../lib/mailer.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { User } from '../modules/users/users.model.js'
import { createUser, testEmail, useTestDb } from './helpers/index.js'

useTestDb([User, EmailLog])

const resetEmail = (to, userId) => sendEmail({ type: 'password_reset', to, userId, params: { name: 'Ana', link: 'http://localhost/r' } })

describe('mailer (§2.8, OD9)', () => {
  it('only logs reserved domains', async () => {
    const reserved = ['a@example.com', 'a@example.org', 'a@example.net', 'a@lab.test', 'a@x.invalid', 'a@localhost', 'a@mail.example.com']
    for (const to of reserved) assert.equal(await resetEmail(to), 'suppressed_reserved', to)
    assert.equal(capturedMail.length, 0)
    assert.equal(await EmailLog.countDocuments({ status: 'suppressed_reserved' }), reserved.length)
  })

  it('caps non-critical mail at 400 per 24 h while critical mail still goes out', async () => {
    await EmailLog.insertMany(Array.from({ length: 400 }, () => ({ type: 'new_message', class: 'non_critical', to: 'x@y.eu', status: 'sent' })))
    const to = testEmail()
    assert.equal(await sendEmail({ type: 'new_message', to }), 'skipped_cap')
    assert.equal(await resetEmail(to), 'sent')
    assert.deepEqual(capturedMail.map((mail) => mail.type), ['password_reset'])
  })

  it('skips non-critical mail when the user turned email off', async () => {
    const user = await createUser({ notifyEmail: false })
    assert.equal(await sendEmail({ type: 'application_status', to: user.email, userId: user._id }), 'skipped_toggle')
    assert.equal(await resetEmail(user.email, user._id), 'sent')
  })

  it('renders in the recipient language and logs the send without a body', async () => {
    const to = testEmail()
    await sendEmail({ type: 'verify_email', to, language: 'es', params: { name: 'Ana', link: 'http://localhost/v' } })
    assert.equal(capturedMail[0].subject, 'Confirma tu dirección de correo electrónico')
    const log = await EmailLog.findOne({ to }).lean()
    assert.equal(log.class, 'critical')
    assert.equal(log.language, 'es')
    assert.equal(log.html, undefined)
  })
})
