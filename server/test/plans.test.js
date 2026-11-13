import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { setStripeClient, stripe } from '../lib/stripe.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { AppConfig, Plan, Subscription } from '../modules/payments/payments.model.js'
import { sendRenewalReminders } from '../modules/payments/payments.service.js'
import { syncPortalConfigurations, yearlyAmount } from '../modules/payments/plans.stripe.js'
import { User } from '../modules/users/users.model.js'
import { dailyJobs } from '../jobs/scheduler.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'

/* 2026-11-13: yearly billing, admin-managed plans (Payments › Plans) and the yearly renewal reminder. */

const DAY_MS = 24 * 60 * 60 * 1000
const v1 = '/api/v1'
// Stripe lists a Portal configuration's products only when asked.
const PORTAL_EXPAND = { expand: ['features.subscription_update.products'] }
const ids = (plan) => [...plan.prices, ...plan.yearlyPrices].map((price) => price.stripePriceId)

let original
let stripeConfig
// Plus is shared by every test file: put it back as it was and archive the Prices these tests created (before the
// database closes, so this hook comes first).
after(async () => {
  const changed = await Plan.findOne({ key: 'plus' }).lean()
  await Plan.replaceOne({ key: 'plus' }, original)
  await syncPortalConfigurations(stripeConfig.productIds)
  await stripe().products.update(stripeConfig.productIds.plus, { name: original.name.en })
  for (const id of ids(changed).filter((id) => !ids(original).includes(id))) await stripe().prices.update(id, { active: false })
})
useTestDb([User, Subscription, Notification, AuditEvent])
before(async () => {
  await seedCatalog()
  original = await Plan.findOne({ key: 'plus' }).lean()
  stripeConfig = (await AppConfig.findOne({ key: 'stripe' }).lean()).value
})

describe('yearly prices (seed:catalog)', () => {
  it('rounds 12 months less the discount to whole units, tens from 1,000 up', () => {
    assert.equal(yearlyAmount(1000, 15), 10200)
    assert.equal(yearlyAmount(900, 15), 9200)
    assert.equal(yearlyAmount(5700, 15), 58100)
    assert.equal(yearlyAmount(399000, 15), 4070000)
    assert.equal(yearlyAmount(1000, 0), 12000)
  })

  it('gives every paid plan a yearly Stripe Price per currency at 15% off', async () => {
    const plus = await Plan.findOne({ key: 'plus' }).lean()
    assert.deepEqual([plus.yearlyEnabled, plus.yearlyDiscountPercent, plus.yearlyPrices.length], [true, 15, 8])
    const eur = plus.yearlyPrices.find((price) => price.currency === 'EUR')
    assert.deepEqual([eur.amountMinor, eur.override], [10200, false])
    const price = await stripe().prices.retrieve(eur.stripePriceId)
    assert.deepEqual([price.unit_amount, price.currency, price.recurring.interval, price.active], [10200, 'eur', 'year', true])
    const recruiterPlus = await Plan.findOne({ key: 'recruiter_plus' }).lean()
    assert.equal(recruiterPlus.yearlyPrices.find((entry) => entry.currency === 'EUR').amountMinor, 58100)
    assert.equal(new Set([...ids(plus), ...ids(recruiterPlus)]).size, 32)
    assert.deepEqual((await Plan.findOne({ key: 'free' }).lean()).yearlyPrices, [])
  })

  it('lets the role Portal switch between its own monthly and yearly Prices only', async () => {
    const plus = await Plan.findOne({ key: 'plus' }).lean()
    const portal = await stripe().billingPortal.configurations.retrieve(stripeConfig.portalConfigurationIds.candidate, PORTAL_EXPAND)
    const update = portal.features.subscription_update
    assert.equal(update.enabled, true)
    assert.equal(update.proration_behavior, 'always_invoice')
    assert.deepEqual(update.products.map((product) => product.product), [stripeConfig.productIds.plus])
    assert.deepEqual(new Set(update.products[0].prices), new Set(ids(plus)))
    assert.deepEqual(update.schedule_at_period_end.conditions.map((condition) => condition.type), ['shortening_interval'])
  })
})

describe('plans, quotes and Checkout by interval', () => {
  it('lists the yearly price and its saving in the asked currency; Free has none', async () => {
    const { items } = (await api().get(`${v1}/plans`).query({ currency: 'EUR', role: 'candidate' })).body
    const [free, plus] = items
    assert.equal(free.yearlyPrice, null)
    assert.deepEqual(plus.yearlyPrice, { amountMinor: 10200, currency: 'EUR', savingPercent: 15 })
  })

  it('quotes and checks out the yearly price', async () => {
    const user = await createUser({ pickerCountry: 'DE' })
    const quote = (await api().get(`${v1}/payments/quote`).query({ kind: 'subscription', itemId: 'plus', interval: 'year' }).set(auth(user))).body
    assert.deepEqual([quote.amountMinor, quote.currency, quote.interval], [10200, 'EUR', 'year'])
    const res = await api().post(`${v1}/payments/checkout-sessions`).set(auth(user)).send({ kind: 'subscription', itemId: 'plus', interval: 'year', from: '/candidate' })
    assert.equal(res.status, 201)
    const session = await stripe().checkout.sessions.retrieve(res.body.id, { expand: ['line_items'] })
    const yearly = (await Plan.findOne({ key: 'plus' })).yearlyPrices.find((price) => price.currency === 'EUR')
    assert.deepEqual([session.line_items.data[0].price.id, session.amount_total], [yearly.stripePriceId, 10200])
    await stripe().customers.del((await User.findById(user._id)).stripeCustomerId)
  })
})

describe('admin › Payments › Plans', () => {
  const finance = () => createUser({ role: 'admin', adminAccess: { granted: ['finance.view'] } })
  const manager = () => createUser({ role: 'admin', adminAccess: { granted: ['finance.view', 'finance.manage'] } })
  const bodyOf = (plan, changes = {}) => ({
    name: plan.name,
    features: plan.features,
    yearlyEnabled: plan.yearlyEnabled,
    yearlyDiscountPercent: plan.yearlyDiscountPercent,
    prices: plan.prices.map(({ currency, monthlyMinor, yearlyMinor, yearlyOverride }) => ({ currency, monthlyMinor, yearlyMinor: yearlyOverride ? yearlyMinor : null })),
    ...changes,
  })
  const listed = async (user, key = 'plus') => (await api().get(`${v1}/admin/payments/plans`).set(auth(user))).body.items.find((plan) => plan.key === key)
  const patch = (user, key, body) => api().patch(`${v1}/admin/payments/plans/${key}`).set(auth(user)).send(body)

  it('lists every plan with its prices and subscribers (finance.view)', async () => {
    const staff = await createUser({ role: 'admin', adminAccess: { granted: ['users.view'] } })
    assert.equal((await api().get(`${v1}/admin/payments/plans`).set(auth(staff))).status, 403)
    for (const [interval, amountMinor] of [['month', 900], ['year', 9200], ['month', 800]]) {
      await Subscription.create({ userId: (await createUser())._id, planKey: 'plus', status: 'active', interval, currency: 'GBP', amountMinor })
    }
    const res = await api().get(`${v1}/admin/payments/plans`).set(auth(await finance()))
    assert.deepEqual(
      res.body.items.map((plan) => [plan.key, plan.paid]),
      [['free', false], ['plus', true], ['recruiter_free', false], ['recruiter_plus', true]],
    )
    const plus = res.body.items[1]
    assert.deepEqual(plus.prices.find((row) => row.currency === 'GBP'), { currency: 'GBP', monthlyMinor: 900, yearlyMinor: 9200, yearlyOverride: false })
    assert.deepEqual(plus.subscribers, { month: 2, year: 1, olderPrice: 1 })
    assert.deepEqual(plus.name, { en: 'Plus', es: 'Plus', fr: 'Plus' })
  })

  it('needs finance.manage to change a plan', async () => {
    const viewer = await finance()
    const res = await patch(viewer, 'plus', bodyOf(await listed(viewer)))
    assert.equal(res.status, 403)
  })

  it('creates new Stripe Prices for changed amounts only, recomputes yearly, keeps overrides and updates the Portal', async () => {
    const admin = await manager()
    const before = await Plan.findOne({ key: 'plus' }).lean()
    const plan = await listed(admin)
    const prices = plan.prices.map((row) => ({
      currency: row.currency,
      monthlyMinor: row.currency === 'EUR' ? 1200 : row.monthlyMinor,
      yearlyMinor: row.currency === 'GBP' ? 9000 : null,
    }))
    const res = await patch(admin, 'plus', bodyOf(plan, { yearlyDiscountPercent: 20, prices }))
    assert.equal(res.status, 200)
    const row = (currency) => res.body.prices.find((entry) => entry.currency === currency)
    assert.deepEqual(row('EUR'), { currency: 'EUR', monthlyMinor: 1200, yearlyMinor: 11500, yearlyOverride: false })
    assert.deepEqual(row('GBP'), { currency: 'GBP', monthlyMinor: 900, yearlyMinor: 9000, yearlyOverride: true })
    assert.equal(row('PLN').yearlyMinor, 43200)
    assert.equal(res.body.yearlyDiscountPercent, 20)

    const after = await Plan.findOne({ key: 'plus' }).lean()
    const id = (plan, list, currency) => plan[list].find((price) => price.currency === currency).stripePriceId
    assert.equal(id(after, 'prices', 'GBP'), id(before, 'prices', 'GBP'), 'an unchanged amount keeps its Price')
    assert.notEqual(id(after, 'prices', 'EUR'), id(before, 'prices', 'EUR'))
    const created = await stripe().prices.retrieve(id(after, 'prices', 'EUR'))
    assert.deepEqual([created.unit_amount, created.recurring.interval, created.metadata.db], [1200, 'month', 'eujobs_test'])
    // The seed's shared Price stays active for the other databases and for subscribers who keep it.
    assert.equal((await stripe().prices.retrieve(id(before, 'prices', 'EUR'))).active, true)

    const portal = await stripe().billingPortal.configurations.retrieve(stripeConfig.portalConfigurationIds.candidate, PORTAL_EXPAND)
    assert.deepEqual(new Set(portal.features.subscription_update.products[0].prices), new Set(ids(after)))
    const buyer = await createUser({ pickerCountry: 'FR' })
    const quote = (await api().get(`${v1}/payments/quote`).query({ kind: 'subscription', itemId: 'plus', interval: 'year' }).set(auth(buyer))).body
    assert.equal(quote.amountMinor, 11500)
    const audit = await AuditEvent.findOne({ type: 'payments.plan_updated' }).sort({ at: -1 })
    assert.deepEqual([audit.category, audit.params.plan, String(audit.actor.id)], ['payments', 'Plus', String(admin._id)])

    // Back to €10: the Price this database created for €12 is archived.
    const again = await patch(admin, 'plus', bodyOf(res.body, { prices: res.body.prices.map((entry) => ({ ...entry, monthlyMinor: entry.currency === 'EUR' ? 1000 : entry.monthlyMinor, yearlyMinor: entry.yearlyOverride ? entry.yearlyMinor : null })) }))
    assert.equal(again.status, 200)
    assert.equal((await stripe().prices.retrieve(created.id)).active, false)
  })

  it('edits names and features in three languages and renames the Stripe Product', async () => {
    const admin = await manager()
    const plan = await listed(admin)
    const features = [...plan.features, { en: 'Priority support', es: 'Soporte prioritario', fr: 'Support prioritaire' }]
    const res = await patch(admin, 'plus', bodyOf(plan, { name: { en: 'Plus Pro', es: 'Plus Pro', fr: 'Plus Pro' }, features }))
    assert.equal(res.status, 200)
    assert.equal((await stripe().products.retrieve(stripeConfig.productIds.plus)).name, 'Plus Pro')
    const { items } = (await api().get(`${v1}/plans`).query({ currency: 'EUR', role: 'candidate', language: 'fr' })).body
    assert.deepEqual([items[1].name, items[1].features.at(-1)], ['Plus Pro', 'Support prioritaire'])
    assert.equal((await patch(admin, 'plus', bodyOf(plan))).status, 200)
    // Free has no prices: only its texts change.
    const free = await listed(admin, 'free')
    assert.equal((await patch(admin, 'free', bodyOf(free, { prices: undefined, yearlyEnabled: undefined, yearlyDiscountPercent: undefined }))).status, 200)
    assert.equal((await patch(admin, 'free', bodyOf(free))).status, 422)
  })

  it('refuses a yearly price above 12 months and a missing currency', async () => {
    const admin = await manager()
    const plan = await listed(admin)
    const tooHigh = plan.prices.map((row, index) => ({ currency: row.currency, monthlyMinor: row.monthlyMinor, yearlyMinor: index === 2 ? row.monthlyMinor * 12 + 100 : null }))
    const res = await patch(admin, 'plus', bodyOf(plan, { prices: tooHigh }))
    assert.deepEqual([res.status, res.body.error.fields], [422, { 'prices.2.yearlyMinor': 'too_high' }])
    const missing = await patch(admin, 'plus', bodyOf(plan, { prices: tooHigh.slice(1) }))
    assert.deepEqual(missing.body.error.fields, { prices: 'invalid' })
  })

  it('saves nothing when Stripe fails', async () => {
    const admin = await manager()
    const plan = await listed(admin)
    const before = await Plan.findOne({ key: 'plus' }).lean()
    setStripeClient({
      prices: {
        create: async () => {
          throw Object.assign(new Error('down'), { type: 'StripeConnectionError' })
        },
      },
    })
    try {
      const res = await patch(admin, 'plus', bodyOf(plan, { prices: plan.prices.map((row) => ({ currency: row.currency, monthlyMinor: row.monthlyMinor + 100, yearlyMinor: null })) }))
      assert.equal(res.body.error.code, 'PAYMENT_PROVIDER_ERROR')
    } finally {
      setStripeClient()
    }
    assert.deepEqual((await Plan.findOne({ key: 'plus' }).lean()).prices, before.prices)
  })

  it('turning yearly off hides it from plans, quotes and the Portal', async () => {
    const admin = await manager()
    const plan = await listed(admin)
    assert.equal((await patch(admin, 'plus', bodyOf(plan, { yearlyEnabled: false }))).status, 200)
    const { items } = (await api().get(`${v1}/plans`).query({ currency: 'EUR', role: 'candidate' })).body
    assert.equal(items[1].yearlyPrice, null)
    const buyer = await createUser({ pickerCountry: 'DE' })
    const quote = await api().get(`${v1}/payments/quote`).query({ kind: 'subscription', itemId: 'plus', interval: 'year' }).set(auth(buyer))
    assert.deepEqual(quote.body.error.fields, { interval: 'not_allowed' })
    const portal = await stripe().billingPortal.configurations.retrieve(stripeConfig.portalConfigurationIds.candidate, PORTAL_EXPAND)
    assert.equal(portal.features.subscription_update.enabled, false)
    assert.equal((await patch(admin, 'plus', bodyOf(plan, { yearlyEnabled: true }))).status, 200)
  })
})

describe('yearly renewal reminder', () => {
  it('runs daily and reminds yearly subscribers once, 7 days before renewal', async () => {
    assert.ok(dailyJobs.some((job) => job.name === 'renewal-reminders'))
    const now = new Date()
    const subscriber = async (fields) => {
      const user = await createUser()
      await Subscription.create({ userId: user._id, planKey: 'plus', status: 'active', currency: 'EUR', amountMinor: 10200, interval: 'year', ...fields })
      return user
    }
    const due = await subscriber({ currentPeriodEnd: new Date(now.getTime() + 6 * DAY_MS) })
    const later = await subscriber({ currentPeriodEnd: new Date(now.getTime() + 10 * DAY_MS) })
    const monthly = await subscriber({ interval: 'month', amountMinor: 1000, currentPeriodEnd: new Date(now.getTime() + 2 * DAY_MS) })
    const ending = await subscriber({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date(now.getTime() + 3 * DAY_MS) })
    const switching = await subscriber({ pendingInterval: 'month', currentPeriodEnd: new Date(now.getTime() + 3 * DAY_MS) })
    await sendRenewalReminders(now)
    await sendRenewalReminders(now)
    const [mail, ...more] = mailTo(due.email, 'renewal_reminder')
    assert.equal(more.length, 0)
    assert.deepEqual([mail.params.plan, mail.params.amount, mail.subject.startsWith('Your Plus plan renews on')], ['Plus', '€102.00', true])
    for (const user of [later, monthly, ending, switching]) assert.equal(mailTo(user.email, 'renewal_reminder').length, 0)
    const notification = await Notification.findOne({ userId: due._id })
    assert.deepEqual([notification.type, notification.params.interval], ['renewal_reminder', 'year'])
  })
})
