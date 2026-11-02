import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const localized = { en: String, es: String, fr: String }

/* Plan catalogue (M-115, M-116, OD1): edited through seed:catalog. Stripe price ids arrive in Phase 5. */
const planSchema = new Schema(
  {
    key: { type: String, enum: ENUMS.planKey, required: true, unique: true },
    name: localized,
    features: [{ _id: false, ...localized }],
    interval: { type: String, enum: ['month'], default: 'month' },
    prices: [{ _id: false, currency: String, amountMinor: Number, stripePriceId: String }],
    entitlements: [{ type: String, enum: ENUMS.entitlement }],
  },
  { timestamps: true },
)

/* Server-side settings, e.g. AppConfig('stripe') = { productId, portalConfigurationId } (U40, P6). */
const appConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
  },
  { timestamps: true },
)

export const Plan = mongoose.model('Plan', planSchema)
export const AppConfig = mongoose.model('AppConfig', appConfigSchema)

/*
 * The candidate's Stripe subscription, mirrored from the webhooks (U38, M-119 … M-121). One row per user,
 * replaced when the user subscribes again. `retrying` comes from the last failed invoice (§2.10).
 */
const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    planKey: { type: String, enum: ENUMS.planKey, default: 'plus' },
    status: { type: String, required: true },
    retrying: { type: Boolean, default: false },
    currency: String,
    amountMinor: Number,
    stripeCustomerId: String,
    stripeSubscriptionId: { type: String, index: true },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    startedAt: Date,
    source: { type: String, enum: ENUMS.paymentSource, default: 'stripe' },
  },
  { timestamps: true },
)

/* One row per one-time payment and per invoice (M-122, M-128, OD8); written by the webhook or the seed. */
const paymentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    payerRole: { type: String, enum: ['candidate', 'recruiter'] },
    payerName: String,
    kind: { type: String, enum: ENUMS.paymentKind, required: true },
    itemId: String,
    itemName: String,
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ENUMS.paymentStatus, required: true },
    failureReason: String,
    method: { type: { type: String }, brand: String, last4: String },
    receiptUrl: String,
    periodStart: Date,
    periodEnd: Date,
    stripe: { checkoutSessionId: String, paymentIntentId: String, invoiceId: String, subscriptionId: String, chargeId: String },
    source: { type: String, enum: ENUMS.paymentSource, default: 'stripe' },
    paidAt: Date,
  },
  { timestamps: true },
)
paymentSchema.index({ userId: 1, paidAt: -1 })
// One row per invoice and per Checkout session, whatever order or how often Stripe delivers the events.
paymentSchema.index({ 'stripe.invoiceId': 1 }, { unique: true, partialFilterExpression: { 'stripe.invoiceId': { $type: 'string' } } })
paymentSchema.index({ 'stripe.checkoutSessionId': 1 }, { unique: true, partialFilterExpression: { 'stripe.checkoutSessionId': { $type: 'string' } } })
paymentSchema.index({ 'stripe.paymentIntentId': 1 })

/* Server sequences, e.g. { _id: 'paymentReference', seq } for LWM-000001 (M-128). */
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } })

/* Processed webhook events: inserted first, so a redelivered event is a no-op (ordering item 11). */
const stripeEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true },
  type: String,
  processedAt: { type: Date, default: Date.now },
})

export const Subscription = mongoose.model('Subscription', subscriptionSchema)
export const Payment = mongoose.model('Payment', paymentSchema)
export const Counter = mongoose.model('Counter', counterSchema)
export const StripeEvent = mongoose.model('StripeEvent', stripeEventSchema)
