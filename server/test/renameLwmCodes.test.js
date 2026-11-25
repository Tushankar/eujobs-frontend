import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import mongoose from 'mongoose'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { Certificate } from '../modules/learning/learning.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Payment } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { renameLwmCodes } from '../scripts/renameLwmCodes.js'
import { createUser, useTestDb } from './helpers/index.js'

useTestDb([User, Payment, Certificate, AuditEvent])

const payment = (reference) => Payment.create({ reference, payerRole: 'candidate', payerName: 'P', kind: 'course', itemName: 'x', amountMinor: 900, currency: 'GBP', status: 'paid', paidAt: new Date() })
const certificate = (code) => Certificate.create({ code, courseId: new mongoose.Types.ObjectId(), issuedAt: new Date() })

describe('scripts/renameLwmCodes.js (EU Jobs rename, 2026-11-25)', () => {
  it('renames LWM- payment references and certificate codes everywhere they are stored, once', async () => {
    const user = await createUser({ role: 'candidate' })
    await Promise.all([payment('LWM-000020'), payment('EUJ-000021'), certificate('LWM-7K3P-Q9XD'), certificate('LWM-AAAA-BBBB'), certificate('EUJ-AAAA-BBBB')])
    await Notification.create({ userId: user._id, type: 'certificate_issued', params: { course: 'C', code: 'LWM-7K3P-Q9XD' }, target: { kind: 'course', id: 'x' }, at: new Date() })
    await AuditEvent.create({ type: 'payments.payment_refunded', category: 'payments', actor: { type: 'system' }, params: { reference: 'LWM-000020', payer: 'P' } })
    await User.updateOne({ _id: user._id }, { celebrations: [{ kind: 'certificate', params: { course: 'C', code: 'LWM-7K3P-Q9XD' }, at: new Date() }, { kind: 'plan', params: { plan: 'plus' }, at: new Date() }] })

    const result = await renameLwmCodes()
    assert.deepEqual(result, { payments: 1, certificates: 1, notifications: 1, audit: 1, celebrations: 1, skipped: ['LWM-AAAA-BBBB'] })
    assert.deepEqual((await Payment.find().sort({ reference: 1 })).map((row) => row.reference), ['EUJ-000020', 'EUJ-000021'])
    assert.ok(await Certificate.exists({ code: 'EUJ-7K3P-Q9XD' }))
    assert.equal((await Notification.findOne({ userId: user._id })).params.code, 'EUJ-7K3P-Q9XD')
    assert.deepEqual((await AuditEvent.findOne()).params, { reference: 'EUJ-000020', payer: 'P' })
    const { celebrations } = await User.findById(user._id).lean()
    assert.deepEqual(celebrations.map((item) => item.params), [{ course: 'C', code: 'EUJ-7K3P-Q9XD' }, { plan: 'plus' }])

    // Safe to rerun: nothing left to change.
    assert.deepEqual(await renameLwmCodes(), { payments: 0, certificates: 0, notifications: 0, audit: 0, celebrations: 0, skipped: ['LWM-AAAA-BBBB'] })
  })
})
