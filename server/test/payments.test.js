import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { after, before, describe, it } from 'node:test'
import { setStripeClient, stripe, testSignature } from '../lib/stripe.js'
import { requireAuth } from '../middleware/auth.js'
import { requireEntitlement } from '../middleware/entitlements.js'
import { errorHandler } from '../middleware/error.js'
import { Company } from '../modules/companies/companies.model.js'
import { Course, Enrollment } from '../modules/learning/learning.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Counter, Payment, Plan, StripeEvent, Subscription } from '../modules/payments/payments.model.js'
import { isPaid, nextReference } from '../modules/payments/payments.service.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLUS_PRICES } from '../seed/data/catalog.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'

useTestDb([User, Company, Subscription, Payment, Counter, StripeEvent, Course, Enrollment, Notification])
before(() => seedCatalog())

const DAY = 24 * 60 * 60
const NOW = Math.floor(Date.now() / 1000)

describe('entitlement rule (U38, M-120)', () => {
  it('is paid for active and trialing, and for past_due only while Stripe retries', () => {
    const cases = [
      ['active', false, true],
      ['active', true, true],
      ['trialing', false, true],
      ['past_due', true, true],
      ['past_due', false, false],
      ['unpaid', false, false],
      ['unpaid', true, false],
      ['canceled', false, false],
      ['incomplete', false, false],
      ['incomplete_expired', false, false],
      ['paused', false, false],
    ]
    for (const [status, retrying, paid] of cases) assert.equal(isPaid({ status, retrying }), paid, `${status} retrying=${retrying}`)
    assert.equal(isPaid(null), false)
  })

  it('puts plan and entitlements in /me', async () => {
    const free = await createUser()
    const me = (await api().get('/api/v1/me').set(auth(free))).body
    assert.deepEqual([me.plan, me.entitlements], ['free', []])
    const plus = await createUser()
    await Subscription.create({ userId: plus._id, status: 'past_due', retrying: true, currency: 'GBP' })
    const mePlus = (await api().get('/api/v1/me').set(auth(plus))).body
    assert.deepEqual([mePlus.plan, mePlus.entitlements], ['plus', ['apply', 'message_send', 'job_alerts', 'ai']])
  })

  it('requireEntitlement answers 402 PLAN_REQUIRED for Free candidates only', async () => {
    const app = express().get('/gated', requireAuth, requireEntitlement('ai'), (req, res) => res.json({ ok: true }))
    app.use(errorHandler)
    const free = await createUser()
    const denied = await request(app).get('/gated').set(auth(free))
    assert.equal(denied.status, 402)
    assert.deepEqual(denied.body.error, { code: 'PLAN_REQUIRED', params: { entitlement: 'ai' } })
    const plus = await createUser()
    await Subscription.create({ userId: plus._id, status: 'active', currency: 'GBP' })
    assert.equal((await request(app).get('/gated').set(auth(plus))).status, 200)
    // Recruiters have no plan (M-117).
    const recruiter = await createUser({ role: 'recruiter' })
    assert.equal((await request(app).get('/gated').set(auth(recruiter))).status, 200)
  })
})

describe('reference sequence (M-128)', () => {
  it('gives unique consecutive LWM- numbers under concurrency', async () => {
    const references = await Promise.all(Array.from({ length: 25 }, () => nextReference()))
    assert.equal(new Set(references).size, 25)
    assert.deepEqual([...references].sort(), Array.from({ length: 25 }, (_, i) => `LWM-${String(i + 1).padStart(6, '0')}`))
  })
})

describe('quotes and currencies (M-124, M-130, OD1)', () => {
  const quote = (user, kind = 'subscription', itemId = 'plus') => api().get('/api/v1/payments/quote').query({ kind, itemId }).set(auth(user))
  const COUNTRY_OF = { GBP: 'GB', EUR: 'DE', PLN: 'PL', SEK: 'SE', DKK: 'DK', CZK: 'CZ', HUF: 'HU', RON: 'RO' }

  it('equals OD1 in every currency, from the header country', async () => {
    for (const [currency, amount] of Object.entries(PLUS_PRICES)) {
      const user = await createUser({ pickerCountry: COUNTRY_OF[currency], language: 'es' })
      const { body } = await quote(user)
      assert.deepEqual(body, { kind: 'subscription', itemId: 'plus', itemName: 'Plus', amountMinor: amount * 100, currency, interval: 'month' })
    }
  })

  it('uses EUR for Remote', async () => {
    const user = await createUser({ pickerCountry: 'REMOTE' })
    assert.equal((await quote(user)).body.currency, 'EUR')
  })

  it('prices a published course of the buyer audience; free, draft and other-audience courses are refused', async () => {
    const candidate = await createUser({ pickerCountry: 'DE' })
    const prices = [{ currency: 'EUR', amountMinor: 3400 }]
    const course = await Course.create({ audience: 'candidate', title: 'Portfolio storytelling', status: 'published', prices })
    assert.deepEqual((await quote(candidate, 'course', String(course._id))).body, {
      kind: 'course',
      itemId: String(course._id),
      itemName: 'Portfolio storytelling',
      amountMinor: 3400,
      currency: 'EUR',
      interval: null,
    })
    const free = await Course.create({ audience: 'candidate', title: 'Free one', status: 'published', isFree: true })
    const draft = await Course.create({ audience: 'candidate', title: 'Draft', status: 'draft', prices })
    const recruiterCourse = await Course.create({ audience: 'recruiter', title: 'Hiring', status: 'published', prices })
    assert.equal((await quote(candidate, 'course', String(free._id))).status, 422)
    assert.equal((await quote(candidate, 'course', String(draft._id))).status, 404)
    assert.equal((await quote(candidate, 'course', String(recruiterCourse._id))).status, 404)
  })

  it('lets only candidates and approved recruiters buy; recruiters cannot buy the plan', async () => {
    const admin = await createUser({ role: 'admin' })
    assert.equal((await quote(admin)).status, 403)
    const pending = await createUser({ role: 'recruiter', status: 'pending_review' })
    assert.equal((await quote(pending)).body.error.code, 'RECRUITER_NOT_APPROVED')
    const company = await Company.create({ ownerUserId: pending._id, legalName: 'Acme Ltd', displayName: 'Acme' })
    const recruiter = await createUser({ role: 'recruiter', companyId: company._id })
    assert.equal((await quote(recruiter)).status, 422)
  })

  it('shows Billing in the subscription currency, not the header country (C14)', async () => {
    const user = await createUser({ pickerCountry: 'PL' })
    await Subscription.create({ userId: user._id, status: 'active', currency: 'GBP', amountMinor: 900 })
    const { subscription } = (await api().get('/api/v1/candidate/subscription').set(auth(user))).body
    assert.deepEqual([subscription.currency, subscription.amountMinor, subscription.paid], ['GBP', 900, true])
  })
})

describe('Checkout and Portal sessions (U40, C13, M-121; real test-mode Stripe)', () => {
  const customers = []
  after(async () => {
    for (const id of customers) await stripe().customers.del(id)
  })

  it('creates a hosted subscription Checkout with card + Link, adaptive pricing off, locale and currency', async () => {
    const user = await createUser({ pickerCountry: 'PL', language: 'fr' })
    const res = await api().post('/api/v1/payments/checkout-sessions').set(auth(user)).send({ kind: 'subscription', itemId: 'plus', from: '/candidate/ai-insights' })
    assert.equal(res.status, 201)
    assert.match(res.body.url, /^https:\/\/checkout\.stripe\.com\//)
    const fresh = await User.findById(user._id)
    customers.push(fresh.stripeCustomerId)
    const session = await stripe().checkout.sessions.retrieve(res.body.id, { expand: ['line_items', 'customer'] })
    assert.deepEqual(session.payment_method_types, ['card', 'link'])
    assert.equal(session.adaptive_pricing.enabled, false)
    assert.deepEqual([session.mode, session.locale, session.currency, session.client_reference_id], ['subscription', 'fr', 'pln', String(user._id)])
    assert.deepEqual(session.metadata, { kind: 'subscription', itemId: 'plus', userId: String(user._id) })
    const pln = (await Plan.findOne({ key: 'plus' })).prices.find((price) => price.currency === 'PLN')
    assert.equal(session.line_items.data[0].price.id, pln.stripePriceId)
    assert.equal(session.amount_total, 4500)
    assert.ok(session.success_url.includes('/candidate/checkout/return?session_id={CHECKOUT_SESSION_ID}&from=%2Fcandidate%2Fai-insights'))
    assert.ok(session.cancel_url.endsWith('/candidate/ai-insights'))
    assert.deepEqual(session.customer.metadata, { db: 'eujobs_test', userId: String(user._id) })

    // The return page sees an open, unfulfilled session; another user gets 404.
    const status = (await api().get(`/api/v1/payments/checkout-sessions/${res.body.id}`).set(auth(user))).body
    assert.deepEqual([status.status, status.fulfilled], ['open', false])
    const other = await createUser()
    assert.equal((await api().get(`/api/v1/payments/checkout-sessions/${res.body.id}`).set(auth(other))).status, 404)

    // A second Checkout reuses the customer.
    const again = await api().post('/api/v1/payments/checkout-sessions').set(auth(user)).send({ kind: 'subscription', itemId: 'plus', from: '/candidate' })
    assert.equal((await stripe().checkout.sessions.retrieve(again.body.id)).customer, fresh.stripeCustomerId)
  })

  it('refuses a return page outside the buyer workspace and a second paid subscription', async () => {
    const user = await createUser()
    const outside = await api().post('/api/v1/payments/checkout-sessions').set(auth(user)).send({ kind: 'subscription', itemId: 'plus', from: '/recruiter/jobs' })
    assert.deepEqual(outside.body.error.fields, { from: 'invalid' })
    const external = await api().post('/api/v1/payments/checkout-sessions').set(auth(user)).send({ kind: 'subscription', itemId: 'plus', from: '//evil.example' })
    assert.equal(external.status, 422)
    await Subscription.create({ userId: user._id, status: 'active', currency: 'GBP' })
    const twice = await api().post('/api/v1/payments/checkout-sessions').set(auth(user)).send({ kind: 'subscription', itemId: 'plus', from: '/candidate' })
    assert.equal(twice.body.error.code, 'CONFLICT')
  })

  it('opens the Portal only for subscribers, with the P6 configuration', async () => {
    const free = await createUser()
    assert.equal((await api().post('/api/v1/payments/portal-session').set(auth(free))).status, 403)
    const subscriber = await createUser()
    const customer = await stripe().customers.create({ metadata: { db: 'eujobs_test', userId: String(subscriber._id) } })
    customers.push(customer.id)
    await Subscription.create({ userId: subscriber._id, status: 'canceled', currency: 'GBP', stripeCustomerId: customer.id })
    const res = await api().post('/api/v1/payments/portal-session').set(auth(subscriber))
    assert.match(res.body.url, /^https:\/\/billing\.stripe\.com\//)
  })
})

describe('webhook (§2.10; signed constructed payloads)', () => {
  // Objects the handlers fetch again by id; the fake client answers from here.
  const objects = new Map()
  const put = (object) => objects.set(object.id, structuredClone(object))
  const fetch = async (id) => {
    if (!objects.has(id)) throw Object.assign(new Error('missing'), { code: 'resource_missing' })
    return structuredClone(objects.get(id))
  }
  let failNext = false
  before(() =>
    setStripeClient({
      subscriptions: {
        retrieve: async (id) => {
          if (failNext) {
            failNext = false
            throw new Error('boom')
          }
          const subscription = await fetch(id)
          return { ...subscription, latest_invoice: subscription.latest_invoice && (await fetch(subscription.latest_invoice)) }
        },
      },
      invoices: { retrieve: fetch },
      paymentIntents: { retrieve: fetch },
      charges: { retrieve: fetch },
      checkout: { sessions: { retrieve: fetch } },
    }),
  )
  after(() => setStripeClient())

  let eventCount = 0
  const send = async (type, id, eventId = `evt_test_${++eventCount}`) => {
    const payload = JSON.stringify({ id: eventId, object: 'event', type, data: { object: { id } } })
    return api().post('/api/v1/stripe/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', testSignature(payload)).send(payload)
  }

  /** A candidate with a Stripe subscription `sub` whose first invoice `in_1` was paid by `pi_1`. */
  async function subscriber(tag) {
    const user = await createUser({ stripeCustomerId: `cus_${tag}` })
    const ids = { sub: `sub_${tag}`, in1: `in_${tag}_1`, pi1: `pi_${tag}_1`, ch1: `ch_${tag}_1` }
    const meta = { kind: 'subscription', itemId: 'plus', userId: String(user._id) }
    const subscription = (fields = {}) => ({
      id: ids.sub,
      customer: `cus_${tag}`,
      status: 'active',
      currency: 'gbp',
      start_date: NOW,
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: meta,
      latest_invoice: ids.in1,
      items: { data: [{ price: { unit_amount: 900 }, current_period_start: NOW, current_period_end: NOW + 30 * DAY }] },
      ...fields,
    })
    const invoice = (id, intent, fields = {}) => ({
      id,
      customer: `cus_${tag}`,
      status: 'paid',
      attempted: true,
      billing_reason: 'subscription_create',
      amount_paid: 900,
      amount_due: 900,
      currency: 'gbp',
      next_payment_attempt: null,
      hosted_invoice_url: `https://invoice.stripe.com/i/${id}`,
      created: NOW,
      status_transitions: { paid_at: NOW },
      parent: { subscription_details: { subscription: ids.sub, metadata: meta } },
      lines: { data: [{ period: { start: NOW, end: NOW + 30 * DAY } }] },
      payments: { data: [{ status: fields.status === 'open' ? 'open' : 'paid', payment: { payment_intent: intent } }] },
      ...fields,
    })
    const charge = (id, fields = {}) => ({ id, created: NOW, refunded: false, payment_method_details: { type: 'card', card: { brand: 'visa', last4: '4242' } }, ...fields })
    put(subscription())
    put(invoice(ids.in1, ids.pi1))
    put({ id: ids.pi1, latest_charge: charge(ids.ch1) })
    return { user, ids, subscription, invoice, charge }
  }

  it('rejects a bad signature with 400', async () => {
    const res = await api().post('/api/v1/stripe/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', 't=1,v1=bad').send('{"id":"evt_x"}')
    assert.equal(res.status, 400)
  })

  it('mirrors the subscription and records the first invoice once, however often it is delivered', async () => {
    const { user, ids } = await subscriber('first')
    assert.equal((await send('customer.subscription.created', ids.sub)).status, 200)
    assert.equal((await api().get('/api/v1/me').set(auth(user))).body.plan, 'plus')
    await send('invoice.paid', ids.in1, 'evt_first_paid')
    await send('invoice.paid', ids.in1, 'evt_first_paid')
    // A different event about the same invoice still adds nothing.
    await send('invoice.paid', ids.in1)
    const rows = await Payment.find({ userId: user._id })
    assert.equal(rows.length, 1)
    const [row] = rows
    assert.match(row.reference, /^LWM-\d{6}$/)
    assert.deepEqual(
      [row.kind, row.status, row.amountMinor, row.currency, row.method.brand, row.method.last4, row.receiptUrl, row.stripe.chargeId],
      ['subscription', 'paid', 900, 'GBP', 'visa', '4242', `https://invoice.stripe.com/i/${ids.in1}`, ids.ch1],
    )
    const payments = (await api().get('/api/v1/me/payments').set(auth(user))).body
    assert.equal(payments.total, 1)
    assert.equal(payments.items[0].receiptUrl, `https://invoice.stripe.com/i/${ids.in1}`)
  })

  it('records a renewal as a second row', async () => {
    const { user, ids, invoice, charge } = await subscriber('renew')
    await send('invoice.paid', ids.in1)
    put(invoice('in_renew_2', 'pi_renew_2', { billing_reason: 'subscription_cycle', lines: { data: [{ period: { start: NOW + 30 * DAY, end: NOW + 60 * DAY } }] } }))
    put({ id: 'pi_renew_2', latest_charge: charge('ch_renew_2') })
    await send('invoice.paid', 'in_renew_2')
    const rows = await Payment.find({ userId: user._id }).sort({ reference: 1 })
    assert.equal(rows.length, 2)
    assert.equal(rows[1].periodStart.getTime(), (NOW + 30 * DAY) * 1000)
  })

  it('keeps Plus while Stripe retries a failed renewal, then ends it with plan_ended', async () => {
    const { user, ids, subscription, invoice, charge } = await subscriber('fail')
    await send('customer.subscription.created', ids.sub)
    const failing = (next) =>
      invoice('in_fail_2', 'pi_fail_2', { status: 'open', amount_paid: 0, billing_reason: 'subscription_cycle', next_payment_attempt: next })
    put(failing(NOW + 3 * DAY))
    put({ id: 'pi_fail_2', latest_charge: charge('ch_fail_2', { failure_code: 'card_declined' }) })
    put(subscription({ status: 'past_due', latest_invoice: 'in_fail_2' }))
    await send('invoice.payment_failed', 'in_fail_2')
    let row = await Payment.findOne({ 'stripe.invoiceId': 'in_fail_2' })
    assert.deepEqual([row.status, row.failureReason, row.amountMinor], ['failed', 'card_declined', 900])
    assert.equal((await Subscription.findOne({ userId: user._id })).retrying, true)
    assert.equal((await api().get('/api/v1/me').set(auth(user))).body.plan, 'plus')
    assert.equal(mailTo(user.email, 'renewal_failed').length, 1)

    // Another failed retry: no second email. The last attempt: no further retry → Free ("leave past due").
    await send('invoice.payment_failed', 'in_fail_2')
    put(failing(null))
    await send('invoice.payment_failed', 'in_fail_2')
    assert.equal(mailTo(user.email, 'renewal_failed').length, 1)
    assert.equal((await api().get('/api/v1/me').set(auth(user))).body.plan, 'free')
    assert.equal(mailTo(user.email, 'plan_ended').length, 1)
    assert.equal(await Payment.countDocuments({ 'stripe.invoiceId': 'in_fail_2' }), 1)

    // Stripe then marks it unpaid: still Free, no second plan_ended.
    put(subscription({ status: 'unpaid', latest_invoice: 'in_fail_2' }))
    await send('customer.subscription.updated', ids.sub)
    assert.equal(mailTo(user.email, 'plan_ended').length, 1)
    row = await Payment.findOne({ 'stripe.invoiceId': 'in_fail_2' })
    assert.equal(row.status, 'failed')
  })

  it('a renewal paid on retry turns its failed row into paid and clears retrying', async () => {
    const { user, subscription, invoice, charge } = await subscriber('retry')
    put(invoice('in_retry_2', 'pi_retry_2', { status: 'open', amount_paid: 0, billing_reason: 'subscription_cycle', next_payment_attempt: NOW + DAY }))
    put({ id: 'pi_retry_2', latest_charge: charge('ch_retry_2', { failure_code: 'card_declined' }) })
    put(subscription({ status: 'past_due', latest_invoice: 'in_retry_2' }))
    await send('invoice.payment_failed', 'in_retry_2')
    put(invoice('in_retry_2', 'pi_retry_2', { billing_reason: 'subscription_cycle' }))
    put(subscription({ latest_invoice: 'in_retry_2' }))
    await send('invoice.paid', 'in_retry_2')
    assert.equal((await Payment.findOne({ 'stripe.invoiceId': 'in_retry_2' })).status, 'paid')
    assert.equal((await Subscription.findOne({ userId: user._id })).retrying, false)
    assert.equal(mailTo(user.email, 'plan_ended').length, 0)
  })

  it('does not record a declined first payment', async () => {
    const { user, ids, invoice, charge } = await subscriber('declined')
    put(invoice(ids.in1, ids.pi1, { status: 'open', amount_paid: 0, billing_reason: 'subscription_create' }))
    put({ id: ids.pi1, latest_charge: charge(ids.ch1, { failure_code: 'card_declined' }) })
    await send('invoice.payment_failed', ids.in1)
    assert.equal(await Payment.countDocuments({ userId: user._id }), 0)
  })

  it('shows cancel-at-period-end, then Free with plan_ended when the subscription is deleted', async () => {
    const { user, ids, subscription } = await subscriber('cancel')
    await send('customer.subscription.created', ids.sub)
    // The Portal may set cancel_at instead of cancel_at_period_end.
    put(subscription({ cancel_at: NOW + 30 * DAY }))
    await send('customer.subscription.updated', ids.sub)
    const billing = (await api().get('/api/v1/candidate/subscription').set(auth(user))).body.subscription
    assert.deepEqual([billing.cancelAtPeriodEnd, billing.paid], [true, true])
    put(subscription({ status: 'canceled', cancel_at: NOW + 30 * DAY }))
    await send('customer.subscription.deleted', ids.sub)
    assert.equal((await api().get('/api/v1/me').set(auth(user))).body.plan, 'free')
    assert.equal(mailTo(user.email, 'plan_ended').length, 1)
  })

  it('a late event of an older subscription does not overwrite a newer one', async () => {
    const { user, ids, subscription } = await subscriber('old')
    put(subscription({ id: 'sub_new', start_date: NOW + 60 }))
    await send('customer.subscription.created', 'sub_new')
    put(subscription({ status: 'canceled' }))
    await send('customer.subscription.deleted', ids.sub)
    const row = await Subscription.findOne({ userId: user._id })
    assert.deepEqual([row.stripeSubscriptionId, row.status], ['sub_new', 'active'])
  })

  it('marks a fully refunded charge refunded', async () => {
    const { user, ids, charge } = await subscriber('refund')
    await send('invoice.paid', ids.in1)
    put(charge(ids.ch1, { refunded: true }))
    await send('charge.refunded', ids.ch1)
    assert.equal((await Payment.findOne({ userId: user._id })).status, 'refunded')
  })

  it('a course Checkout creates one row and one enrollment', async () => {
    const user = await createUser({ pickerCountry: 'DE' })
    const course = await Course.create({ audience: 'candidate', title: 'Portfolio storytelling', status: 'published', prices: [{ currency: 'EUR', amountMinor: 3400 }] })
    put({
      id: 'cs_test_course',
      mode: 'payment',
      payment_status: 'paid',
      amount_total: 3400,
      currency: 'eur',
      metadata: { kind: 'course', itemId: String(course._id), userId: String(user._id) },
      payment_intent: { id: 'pi_course', latest_charge: { id: 'ch_course', created: NOW, receipt_url: 'https://pay.stripe.com/receipts/x', payment_method_details: { type: 'link' } } },
    })
    await send('checkout.session.completed', 'cs_test_course')
    await send('checkout.session.completed', 'cs_test_course')
    const rows = await Payment.find({ userId: user._id })
    assert.equal(rows.length, 1)
    assert.deepEqual([rows[0].kind, rows[0].itemName, rows[0].amountMinor, rows[0].currency, rows[0].method.type], ['course', 'Portfolio storytelling', 3400, 'EUR', 'link'])
    const enrollments = await Enrollment.find({ userId: user._id })
    assert.deepEqual([enrollments.length, enrollments[0].source, String(enrollments[0].paymentId)], [1, 'purchase', String(rows[0]._id)])
  })

  it('notifies payments (P11b-Q1, Q11): Plus paid and failed to the candidate and finance admins only, plan ended, course purchases', async () => {
    const finance = await createUser({ role: 'admin', adminAccess: { granted: ['finance.view'] } })
    const moderator = await createUser({ role: 'admin', adminAccess: { granted: ['moderation.manage'] } })
    const feed = async (user) => (await api().get('/api/v1/notifications').set(auth(user))).body.items
    const { user, ids, subscription, invoice, charge } = await subscriber('notify')
    await send('customer.subscription.created', ids.sub)
    await send('invoice.paid', ids.in1)
    await send('invoice.paid', ids.in1)
    let items = await feed(user)
    assert.deepEqual(items.map((item) => [item.type, item.params, item.path]), [['payment_paid', { item: 'Plus', amountMinor: 900, currency: 'GBP' }, '/candidate/settings/billing']])

    put(invoice('in_notify_2', 'pi_notify_2', { status: 'open', amount_paid: 0, billing_reason: 'subscription_cycle', next_payment_attempt: null }))
    put({ id: 'pi_notify_2', latest_charge: charge('ch_notify_2', { failure_code: 'card_declined' }) })
    put(subscription({ status: 'past_due', latest_invoice: 'in_notify_2' }))
    await send('invoice.payment_failed', 'in_notify_2')
    items = await feed(user)
    assert.deepEqual(items.map((item) => item.type), ['plan_ended', 'renewal_failed', 'payment_paid'])
    const failed = await Payment.findOne({ 'stripe.invoiceId': 'in_notify_2' })
    const [adminItem] = await feed(finance)
    assert.deepEqual([adminItem.type, adminItem.params.reference, adminItem.path], ['admin_renewal_failed', failed.reference, `/admin/payments/${failed._id}`])
    assert.equal(mailTo(finance.email, 'admin_renewal_failed').length, 1)
    assert.deepEqual([(await feed(moderator)).length, mailTo(moderator.email).length], [0, 0])

    // Course purchases: the candidate is told about the course only; a recruiter gets "payment paid".
    const recruiter = await createUser({ role: 'recruiter', status: 'active' })
    const course = await Course.create({ audience: 'candidate', title: 'Portfolio storytelling', status: 'published', prices: [{ currency: 'EUR', amountMinor: 3400 }] })
    for (const [buyer, id] of [[user, 'cs_notify_candidate'], [recruiter, 'cs_notify_recruiter']]) {
      put({ id, mode: 'payment', payment_status: 'paid', amount_total: 3400, currency: 'eur', metadata: { kind: 'course', itemId: String(course._id), userId: String(buyer._id) }, payment_intent: { id: `pi_${id}`, latest_charge: { id: `ch_${id}`, created: NOW } } })
      await send('checkout.session.completed', id)
    }
    const [purchase] = await feed(user)
    assert.deepEqual([purchase.type, purchase.params, purchase.path], ['course_purchased', { course: 'Portfolio storytelling' }, `/candidate/learning/${course._id}`])
    assert.deepEqual((await feed(recruiter)).map((item) => [item.type, item.params.item, item.path]), [['payment_paid', 'Portfolio storytelling', '/recruiter/settings/billing']])
  })

  it('ignores objects of another database and events it does not handle', async () => {
    put({ id: 'sub_elsewhere', customer: 'cus_elsewhere', status: 'active', currency: 'eur', start_date: NOW, metadata: { userId: '0123456789abcdef01234567' }, items: { data: [] } })
    assert.equal((await send('customer.subscription.created', 'sub_elsewhere')).status, 200)
    assert.equal((await send('customer.created', 'cus_elsewhere')).status, 200)
    assert.equal(await Subscription.countDocuments({ stripeSubscriptionId: 'sub_elsewhere' }), 0)
  })

  it('answers 500 when a handler fails and processes the same event when Stripe retries', async () => {
    const { user, ids } = await subscriber('retryevent')
    failNext = true
    assert.equal((await send('customer.subscription.created', ids.sub, 'evt_flaky')).status, 500)
    assert.equal(await StripeEvent.countDocuments({ eventId: 'evt_flaky' }), 0)
    assert.equal((await send('customer.subscription.created', ids.sub, 'evt_flaky')).status, 200)
    assert.equal((await Subscription.findOne({ userId: user._id })).status, 'active')
  })
})
