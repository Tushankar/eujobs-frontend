import { config } from '../../config/env.js'
import { actorFor, recordAudit, SYSTEM_ACTOR } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { callStripe, fromUnix, stripe } from '../../lib/stripe.js'
import { Company } from '../companies/companies.model.js'
import { pauseExtraJobs } from '../jobs/jobs.service.js'
import { Course, Enrollment } from '../learning/learning.model.js'
import { enroll } from '../learning/learning.service.js'
import { Country } from '../meta/meta.model.js'
import { userCurrency } from '../meta/meta.service.js'
import { notify, notifyAdmins } from '../notifications/notifications.service.js'
import { User } from '../users/users.model.js'
import { AppConfig, Counter, Payment, Plan, StripeEvent, Subscription } from './payments.model.js'

/*
 * Plan, Checkout, Portal and the Stripe webhook (§2.10, §3.3, §3.10). Rows change only through webhooks (and the
 * seed): the client learns about a purchase by polling the Checkout session (M-125).
 */

/** U38, M-120: paid while active or trialing, or past due while Stripe still retries the last invoice. */
export function isPaid(subscription) {
  if (!subscription) return false
  return ['active', 'trialing'].includes(subscription.status) || (subscription.status === 'past_due' && subscription.retrying)
}

/** The paid plan of each role (§3.3, §3.22; M-117 superseded by Phase 11c). */
export const PAID_PLAN = { candidate: 'plus', recruiter: 'recruiter_plus' }

/** `me.plan` and `me.entitlements` (§3.3, §3.22), for candidates and recruiters. */
export async function planState(userId) {
  const subscription = await Subscription.findOne({ userId })
  if (!isPaid(subscription)) return { plan: 'free', entitlements: [] }
  const plan = await Plan.findOne({ key: subscription.planKey }, 'entitlements')
  return { plan: subscription.planKey, entitlements: plan?.entitlements ?? [] }
}

/** M-128: LWM-000001, LWM-000002, … (atomic, so concurrent webhooks never share a number). */
export async function nextReference() {
  const { seq } = await Counter.findOneAndUpdate({ _id: 'paymentReference' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  return `LWM-${String(seq).padStart(6, '0')}`
}

const formatAmount = (language, amountMinor, currency) => new Intl.NumberFormat(language, { style: 'currency', currency }).format(amountMinor / 100)

/** A recruiter's plan is charged in the currency of the company's country (P11c-Q2; Remote = EUR). */
export async function companyCurrency(user) {
  const company = await Company.findById(user.companyId, 'location')
  const code = company?.location?.countryCode
  return (code && (await Country.findOne({ code }, 'currency'))?.currency) ?? 'EUR'
}

/** The item, its name in the user's language and its price in the user's currency (M-124, M-130; Remote = EUR). */
async function priceItem(user, kind, itemId) {
  const currency = kind === 'subscription' && user.role === 'recruiter' ? await companyCurrency(user) : ((await userCurrency(user)) ?? 'EUR')
  if (kind === 'subscription') {
    if (itemId !== PAID_PLAN[user.role]) throw fieldError({ itemId: 'not_allowed' })
    const plan = await Plan.findOne({ key: itemId })
    const price = plan.prices.find((entry) => entry.currency === currency)
    return { kind, itemId, itemName: plan.name[user.language], amountMinor: price.amountMinor, currency, interval: plan.interval, stripePriceId: price.stripePriceId }
  }
  const course = /^[a-f\d]{24}$/i.test(itemId) ? await Course.findOne({ _id: itemId, status: 'published', audience: user.role }) : null
  if (!course) throw new AppError('NOT_FOUND')
  // Free courses are enrolled without a payment (§5 POST /learning/enrollments).
  const price = course.isFree ? null : course.prices.find((entry) => entry.currency === currency)
  if (!price) throw fieldError({ itemId: 'not_allowed' })
  return { kind, itemId, itemName: course.title, amountMinor: price.amountMinor, currency, interval: null }
}

export async function quote(user, { kind, itemId }) {
  const { stripePriceId: _stripePriceId, ...item } = await priceItem(user, kind, itemId)
  return item
}

/** One Stripe customer per user (§2.10), tagged with the database and user (P5-Q3). */
async function ensureCustomer(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await callStripe((s) =>
    s.customers.create({
      email: user.email,
      name: user.fullName,
      preferred_locales: [user.language],
      metadata: { db: config.dbName, userId: String(user._id) },
    }),
  )
  const claimed = await User.updateOne({ _id: user._id, stripeCustomerId: null }, { $set: { stripeCustomerId: customer.id } })
  if (claimed.modifiedCount === 1) return customer.id
  // A parallel request saved its customer first: keep that one.
  await callStripe((s) => s.customers.del(customer.id))
  return (await User.findById(user._id, 'stripeCustomerId')).stripeCustomerId
}

/** A hosted Checkout session (U40, C13); the client redirects to `url`. `from` is the page to return to. */
export async function createCheckoutSession(user, { kind, itemId, from }) {
  if (!from.startsWith(`/${user.role}`)) throw fieldError({ from: 'invalid' })
  const item = await priceItem(user, kind, itemId)
  if (kind === 'subscription' && isPaid(await Subscription.findOne({ userId: user._id }))) throw new AppError('CONFLICT')
  if (kind === 'course' && (await Enrollment.exists({ userId: user._id, courseId: itemId }))) throw new AppError('CONFLICT')
  const customer = await ensureCustomer(user)
  const currency = item.currency.toLowerCase()
  const metadata = { kind, itemId, userId: String(user._id) }
  const session = await callStripe((s) =>
    s.checkout.sessions.create({
      mode: kind === 'subscription' ? 'subscription' : 'payment',
      customer,
      currency,
      line_items: [
        kind === 'subscription'
          ? { price: item.stripePriceId, quantity: 1 }
          : { quantity: 1, price_data: { currency, unit_amount: item.amountMinor, product_data: { name: item.itemName } } },
      ],
      // C13: card and Link only (this API version filters the Dashboard's methods instead of `payment_method_types`).
      allowed_payment_method_types: ['card', 'link'],
      locale: user.language,
      adaptive_pricing: { enabled: false },
      client_reference_id: String(user._id),
      metadata,
      ...(kind === 'subscription' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      success_url: `${config.clientOrigin}/${user.role}/checkout/return?session_id={CHECKOUT_SESSION_ID}&from=${encodeURIComponent(from)}`,
      cancel_url: `${config.clientOrigin}${from}`,
    }),
  )
  return { id: session.id, url: session.url }
}

/** M-125: the return page polls until the webhook has applied the purchase (`fulfilled`). */
export async function checkoutSessionStatus(user, id) {
  const session = await callStripe((s) => s.checkout.sessions.retrieve(id, { expand: ['line_items'] }))
  if (session.client_reference_id !== String(user._id)) throw new AppError('NOT_FOUND')
  const kind = session.metadata?.kind
  const fulfilled =
    kind === 'subscription'
      ? isPaid(await Subscription.findOne({ userId: user._id, stripeSubscriptionId: session.subscription }))
      : Boolean(await Payment.exists({ 'stripe.checkoutSessionId': session.id }))
  // The order summary beside the progress (what was bought, for how much), straight from the Stripe session.
  const [line] = session.line_items?.data ?? []
  return {
    id: session.id,
    kind,
    status: session.status,
    paymentStatus: session.payment_status,
    fulfilled,
    itemName: line?.description ?? null,
    amountMinor: session.amount_total,
    currency: session.currency?.toUpperCase() ?? null,
    interval: line?.price?.recurring?.interval ?? null,
    createdAt: fromUnix(session.created),
  }
}

/** M-121: the Stripe Customer Portal (P6 configuration), for candidates and recruiters who have subscribed. */
export async function createPortalSession(user) {
  const subscription = await Subscription.findOne({ userId: user._id })
  if (!subscription) throw new AppError('FORBIDDEN')
  const { value } = await AppConfig.findOne({ key: 'stripe' })
  const session = await callStripe((s) =>
    s.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      configuration: value.portalConfigurationId,
      return_url: billingLink(user),
      locale: user.language,
    }),
  )
  return { url: session.url }
}

/** Billing (§3.10, §3.22): the subscription in its own currency (C14), or null. */
export async function subscriptionDto(userId) {
  const subscription = await Subscription.findOne({ userId })
  if (!subscription) return null
  const { planKey, status, retrying, currency, amountMinor, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, startedAt } = subscription
  return { planKey, status, paid: isPaid(subscription), retrying, currency, amountMinor, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, startedAt }
}

export const paymentDto = (payment) => ({
  id: String(payment._id),
  reference: payment.reference,
  kind: payment.kind,
  itemName: payment.itemName,
  amountMinor: payment.amountMinor,
  currency: payment.currency,
  status: payment.status,
  method: payment.method?.type ? { type: payment.method.type, brand: payment.method.brand ?? null, last4: payment.method.last4 ?? null } : null,
  receiptUrl: payment.receiptUrl ?? null,
  paidAt: payment.paidAt,
  periodStart: payment.periodStart ?? null,
  periodEnd: payment.periodEnd ?? null,
})

/** GET /me/payments: own rows, newest first (M-122). */
export async function listOwnPayments(userId) {
  return (await Payment.find({ userId }).sort({ paidAt: -1 })).map(paymentDto)
}

/* ---------- Webhook (§2.10) ---------- */

/** The user a Stripe object belongs to in this database, or null (another database shares the sandbox). */
async function ownerOf(metadata, customerId) {
  const byId = /^[a-f\d]{24}$/i.test(metadata?.userId ?? '') ? await User.findById(metadata.userId) : null
  const user = byId ?? (customerId ? await User.findOne({ stripeCustomerId: customerId }) : null)
  // An account being erased (DELETE /me) takes no more Stripe events: its cancellation sends no plan_ended.
  return user?.erasedAt ? null : user
}

/** Card or Link details of a charge (M-122). */
const methodOf = (charge) => {
  const details = charge?.payment_method_details
  return details ? { type: details.type, brand: details.card?.brand, last4: details.card?.last4 } : undefined
}

/**
 * Mirrors one Stripe subscription (fetched fresh, so event order and the account's event API version do not matter).
 * `retrying` = past due with a further attempt scheduled on the latest invoice (U38, M-120). Paid → Free sends
 * `plan_ended`, whatever the final retry action; a recruiter's extra jobs are paused first (§3.22).
 */
async function syncSubscription(stripeSubscriptionId) {
  const subscription = await stripe().subscriptions.retrieve(stripeSubscriptionId, { expand: ['latest_invoice'] })
  const user = await ownerOf(subscription.metadata, subscription.customer)
  if (!PAID_PLAN[user?.role]) return
  const before = await Subscription.findOne({ userId: user._id })
  // Late events of an older subscription never overwrite a newer one.
  if (before && before.stripeSubscriptionId !== subscription.id && before.startedAt > fromUnix(subscription.start_date)) return
  const item = subscription.items.data[0]
  const invoice = subscription.latest_invoice
  const next = {
    planKey: PAID_PLAN[user.role],
    status: subscription.status,
    retrying: subscription.status === 'past_due' && invoice?.status === 'open' && invoice.next_payment_attempt !== null,
    currency: subscription.currency.toUpperCase(),
    amountMinor: item.price.unit_amount,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: fromUnix(item.current_period_start),
    currentPeriodEnd: fromUnix(item.current_period_end),
    // The Portal's "cancel at period end" may set cancel_at instead of cancel_at_period_end.
    cancelAtPeriodEnd: subscription.cancel_at_period_end || Boolean(subscription.cancel_at),
    startedAt: fromUnix(subscription.start_date),
  }
  const after = await Subscription.findOneAndUpdate({ userId: user._id }, { $set: next }, { upsert: true, returnDocument: 'after' })
  if (isPaid(before) && !isPaid(after)) await planEnded(user, after.planKey)
}

const BILLING = { kind: 'page', id: 'billing' }
const billingLink = (user) => `${config.clientOrigin}/${user.role}/settings/billing`

/**
 * Paid → Free (M-120, §3.22). A candidate opens Billing. A recruiter keeps only the most recently published job live
 * (P11c-Q6); the notification and email name it and the number paused, and open Jobs (P11c-Q18).
 */
async function planEnded(user, planKey) {
  const plan = await Plan.findOne({ key: planKey }, 'name')
  const params = { name: user.fullName, plan: plan.name[user.language] }
  if (user.role === 'candidate') {
    await notify(user, 'plan_ended', { params: { planKey }, target: BILLING })
    await sendEmail({ type: 'plan_ended', to: user.email, userId: user._id, language: user.language, params: { ...params, link: billingLink(user) } })
    return
  }
  const company = await Company.findById(user.companyId, 'displayName')
  const { kept, paused } = company ? await pauseExtraJobs(company) : { kept: null, paused: 0 }
  await notify(user, 'plan_ended', { params: { planKey, job: kept?.title ?? null, paused }, target: { kind: 'page', id: 'jobs' } })
  // The "kept … paused" line is built from the dictionary (plural by count), or left out when nothing was paused.
  const line = paused ? t(user.language, `labels.pausedJobs.${new Intl.PluralRules(user.language).select(paused) === 'one' ? 'one' : 'other'}`) : ''
  await sendEmail({
    type: 'recruiter_plan_ended',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { ...params, paused: interpolate(line, { job: kept?.title, count: paused }), link: `${config.clientOrigin}/recruiter/jobs` },
  })
}

/** A failed renewal (P11b-Q1, P11c-Q7): the payer opens Billing; admins with `finance.view` open the payment and get its email. */
async function notifyRenewalFailed(user, payment, amount, plan) {
  await notify(user, 'renewal_failed', { params: { planKey: plan.key, ...amount }, target: BILLING })
  await notifyAdmins('admin_renewal_failed', {
    params: { payer: user.fullName, reference: payment.reference, planKey: plan.key, ...amount },
    target: { kind: 'payment', id: payment._id },
    emailParams: (language) => ({
      payer: user.fullName,
      plan: plan.name[language],
      reference: payment.reference,
      amount: formatAmount(language, amount.amountMinor, amount.currency),
      link: `${config.clientOrigin}/admin/payments/${payment._id}`,
    }),
  })
}

async function onSubscription(object) {
  await syncSubscription(object.id)
}

/**
 * invoice.paid / invoice.payment_failed: one row per invoice (paid, or failed for a renewal; M-122), then the
 * subscription state. A first renewal failure sends `renewal_failed`. Declined first payments are not recorded.
 */
async function onInvoice(object) {
  const invoice = await stripe().invoices.retrieve(object.id, { expand: ['payments'] })
  const details = invoice.parent?.subscription_details
  if (!details?.subscription) return
  const subscriptionId = typeof details.subscription === 'string' ? details.subscription : details.subscription.id
  const user = await ownerOf(details.metadata, invoice.customer)
  if (!PAID_PLAN[user?.role]) return

  const paid = invoice.status === 'paid'
  const failedRenewal = !paid && invoice.attempted && invoice.billing_reason === 'subscription_cycle'
  if ((paid && invoice.amount_paid > 0) || failedRenewal) {
    const invoicePayment = invoice.payments?.data.find((entry) => entry.status === 'paid') ?? invoice.payments?.data[0]
    const intentId = invoicePayment?.payment?.payment_intent
    const intent = intentId ? await stripe().paymentIntents.retrieve(typeof intentId === 'string' ? intentId : intentId.id, { expand: ['latest_charge'] }) : null
    const charge = intent?.latest_charge
    const plan = await Plan.findOne({ key: PAID_PLAN[user.role] }, 'key name')
    const line = invoice.lines.data[0]
    const fields = {
      status: paid ? 'paid' : 'failed',
      failureReason: paid ? undefined : (charge?.failure_code ?? intent?.last_payment_error?.code),
      method: methodOf(charge),
      receiptUrl: invoice.hosted_invoice_url,
      'stripe.paymentIntentId': intent?.id,
      'stripe.chargeId': charge?.id,
      paidAt: paid ? fromUnix(invoice.status_transitions.paid_at) : fromUnix(charge?.created ?? invoice.created),
    }
    // Another delivery (or the seed) may record the same invoice at the same moment: the unique index decides.
    const created = await Payment.create({
      ...fields,
      reference: await nextReference(),
      userId: user._id,
      payerRole: user.role,
      payerName: user.fullName,
      kind: 'subscription',
      itemId: plan.key,
      itemName: plan.name[user.language],
      amountMinor: paid ? invoice.amount_paid : invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      periodStart: fromUnix(line?.period.start),
      periodEnd: fromUnix(line?.period.end),
      stripe: { invoiceId: invoice.id, subscriptionId, paymentIntentId: intent?.id, chargeId: charge?.id },
    }).catch((error) => {
      if (error.code === 11000 && error.keyPattern?.['stripe.invoiceId']) return null
      throw error
    })
    if (created) {
      // The first invoice is the payer's own purchase; renewals and their failures are system events.
      const actor = paid && invoice.billing_reason === 'subscription_create' ? actorFor(user) : SYSTEM_ACTOR
      await auditPayment(created, paid ? 'payment_recorded' : 'renewal_failed', actor)
      const amount = { amountMinor: created.amountMinor, currency: created.currency }
      if (paid) await notify(user, 'payment_paid', { params: { item: created.itemName, ...amount }, target: BILLING })
      else await notifyRenewalFailed(user, created, amount, plan)
    }
    if (!created) {
      await Payment.updateOne({ 'stripe.invoiceId': invoice.id }, { $set: fields })
    } else if (!paid) {
      await sendEmail({
        type: 'renewal_failed',
        to: user.email,
        userId: user._id,
        language: user.language,
        params: {
          name: user.fullName,
          plan: plan.name[user.language],
          amount: formatAmount(user.language, invoice.amount_due, invoice.currency.toUpperCase()),
          link: billingLink(user),
        },
      })
    }
  }
  await syncSubscription(subscriptionId)
}

/** checkout.session.completed: a course purchase becomes a row and an enrollment; a subscription is mirrored at once. */
async function onCheckoutCompleted(object) {
  const session = await stripe().checkout.sessions.retrieve(object.id, { expand: ['payment_intent.latest_charge'] })
  if (session.mode === 'subscription') {
    if (session.subscription) await syncSubscription(typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
    return
  }
  if (session.metadata?.kind !== 'course' || session.payment_status !== 'paid') return
  const user = await ownerOf(session.metadata, null)
  const course = user && (await Course.findById(session.metadata.itemId, 'title'))
  if (!course) return
  const intent = session.payment_intent
  const charge = intent?.latest_charge
  let payment = await Payment.findOne({ 'stripe.checkoutSessionId': session.id })
  const recorded = Boolean(payment)
  payment ??= await Payment.create({
    reference: await nextReference(),
    userId: user._id,
    payerRole: user.role,
    payerName: user.fullName,
    kind: 'course',
    itemId: String(course._id),
    itemName: course.title,
    amountMinor: session.amount_total,
    currency: session.currency.toUpperCase(),
    status: 'paid',
    method: methodOf(charge),
    receiptUrl: charge?.receipt_url,
    stripe: { checkoutSessionId: session.id, paymentIntentId: intent?.id, chargeId: charge?.id },
    paidAt: fromUnix(charge?.created) ?? new Date(),
  })
  if (!recorded) {
    await auditPayment(payment, 'payment_recorded', actorFor(user))
    // P11b-Q11: a candidate is told about the course; a recruiter's course purchase is their "payment paid".
    if (user.role === 'candidate') await notify(user, 'course_purchased', { params: { course: course.title }, target: { kind: 'course', id: course._id } })
    else await notify(user, 'payment_paid', { params: { item: course.title, amountMinor: payment.amountMinor, currency: payment.currency }, target: BILLING })
  }
  await enroll({ userId: user._id, courseId: course._id, source: 'purchase', paymentId: payment._id })
}

/** charge.refunded: a fully refunded charge marks its row refunded (M-122). */
async function onChargeRefunded(object) {
  const charge = await stripe().charges.retrieve(object.id)
  if (!charge.refunded) return
  const rows = await Payment.find({ $or: [{ 'stripe.chargeId': charge.id }, { 'stripe.paymentIntentId': charge.payment_intent }], status: { $ne: 'refunded' } })
  for (const row of rows) {
    row.status = 'refunded'
    await row.save()
    await auditPayment(row, 'payment_refunded', SYSTEM_ACTOR)
  }
}

/** M-162, M-163: payment rows are audited in the Payments category. */
function auditPayment(payment, type, actor) {
  return recordAudit({
    type: `payments.${type}`,
    category: 'payments',
    actor,
    target: { type: 'payment', id: payment._id },
    params: { reference: payment.reference, item: payment.itemName, payer: payment.payerName, amountMinor: payment.amountMinor, currency: payment.currency },
  })
}

export const WEBHOOK_HANDLERS = {
  'checkout.session.completed': onCheckoutCompleted,
  'invoice.paid': onInvoice,
  'invoice.payment_failed': onInvoice,
  'customer.subscription.created': onSubscription,
  'customer.subscription.updated': onSubscription,
  'customer.subscription.deleted': onSubscription,
  'charge.refunded': onChargeRefunded,
}

/**
 * Applies one verified event exactly once: the marker is inserted first, so a redelivery does nothing; if the
 * handler throws, the marker is removed and the caller answers 500, so Stripe retries (§2.10).
 */
export async function handleStripeEvent(event) {
  const handler = WEBHOOK_HANDLERS[event.type]
  if (!handler) return
  try {
    await StripeEvent.create({ eventId: event.id, type: event.type })
  } catch (error) {
    if (error.code === 11000) return
    throw error
  }
  try {
    await handler(event.data.object)
  } catch (error) {
    await StripeEvent.deleteOne({ eventId: event.id })
    throw error
  }
}
