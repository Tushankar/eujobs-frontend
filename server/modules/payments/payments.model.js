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
