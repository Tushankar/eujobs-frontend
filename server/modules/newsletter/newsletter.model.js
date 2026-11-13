import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/*
 * Newsletter subscribers (2026-11-13): double opt-in. The emailed token (stored as its SHA-256) confirms the address and
 * later unsubscribes it; a new subscribe issues a new token.
 */
const subscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    language: { type: String, enum: ENUMS.language, default: 'en' },
    status: { type: String, enum: ENUMS.subscriberStatus, default: 'pending' },
    tokenHash: { type: String, required: true, index: true },
    tokenSentAt: { type: Date, required: true },
    confirmedAt: Date,
    unsubscribedAt: Date,
  },
  { timestamps: true },
)

export const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', subscriberSchema)
