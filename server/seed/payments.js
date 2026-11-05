import { DateTime } from 'luxon'
import { config } from '../config/env.js'
import { stripe } from '../lib/stripe.js'
import { Country } from '../modules/meta/meta.model.js'
import { Payment, Plan, Subscription } from '../modules/payments/payments.model.js'
import { nextReference, WEBHOOK_HANDLERS } from '../modules/payments/payments.service.js'
import { User } from '../modules/users/users.model.js'
import { CANDIDATES } from './data/candidates.js'
import { COURSE_PAYMENTS, HISTORICAL_PLUS_DAYS_AGO } from './data/payments.js'

/*
 * Payments of seed:demo (OD8, OQ-4.2, P5-Q4, P11c-Q11): `source: seed` rows without receipt links, Emma's real Stripe
 * test Plus subscription (pm_card_visa) in her header country's currency and Sarah's Recruiter Plus in her company
 * country's (GBP), tagged seed and db. Each first invoice and subscription is written by the webhook handlers
 * themselves, so a later webhook for them adds nothing.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const card = (method) => ({ type: 'card', ...method })

export async function seedPayments({ emailOf, now }) {
  const users = new Map((await User.find({}, 'email fullName role language pickerCountry')).map((user) => [user.email, user]))
  const currencyOf = Object.fromEntries((await Country.find({}, 'code currency')).map((country) => [country.code, country.currency]))
  const plus = await Plan.findOne({ key: 'plus' })
  const plusPrice = (user) => plus.prices.find((price) => price.currency === currencyOf[user.pickerCountry])

  const rows = COURSE_PAYMENTS.map(({ tag, daysAgo, itemName, amount, method }) => ({
    user: users.get(emailOf({ tag })),
    kind: 'course',
    itemName,
    amountMinor: amount * 100,
    currency: 'GBP',
    method: card(method),
    paidAt: new Date(now - daysAgo * DAY_MS),
  }))
  for (const person of CANDIDATES.filter((candidate) => candidate.email)) {
    const user = users.get(person.email)
    const paidAt = new Date(now - HISTORICAL_PLUS_DAYS_AGO * DAY_MS)
    const { amountMinor, currency } = plusPrice(user)
    rows.push({
      user,
      kind: 'subscription',
      itemId: 'plus',
      itemName: plus.name[user.language],
      amountMinor,
      currency,
      method: card({ brand: 'visa', last4: '4242' }),
      paidAt,
      periodStart: paidAt,
      periodEnd: DateTime.fromJSDate(paidAt).plus({ months: 1 }).toJSDate(),
    })
  }
  // References follow the payment dates (M-128).
  rows.sort((a, b) => a.paidAt - b.paidAt)
  for (const { user, ...row } of rows) {
    await Payment.create({ ...row, reference: await nextReference(), userId: user._id, payerRole: user.role, payerName: user.fullName, status: 'paid', source: 'seed' })
  }

  const emma = users.get(emailOf({ tag: 'emma' }))
  await subscribe(emma, 'plus', plusPrice(emma).stripePriceId)
  const recruiterPlus = await Plan.findOne({ key: 'recruiter_plus' })
  await subscribe(users.get(emailOf({ tag: 'sarah' })), 'recruiter_plus', recruiterPlus.prices.find((price) => price.currency === 'GBP').stripePriceId)
}

/** A real Stripe test subscription (pm_card_visa) whose first invoice and state the webhook handlers record. */
async function subscribe(user, planKey, priceId) {
  const metadata = { db: config.dbName, userId: String(user._id), seed: 'true' }
  const customer = await stripe().customers.create({
    email: user.email,
    name: user.fullName,
    preferred_locales: [user.language],
    metadata,
    payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' },
  })
  await User.updateOne({ _id: user._id }, { stripeCustomerId: customer.id })
  const subscription = await stripe().subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    metadata: { kind: 'subscription', itemId: planKey, ...metadata },
  })
  await WEBHOOK_HANDLERS['invoice.paid']({ id: subscription.latest_invoice })
  await Payment.updateOne({ 'stripe.invoiceId': subscription.latest_invoice }, { source: 'seed' })
  await Subscription.updateOne({ userId: user._id }, { source: 'seed' })
}
