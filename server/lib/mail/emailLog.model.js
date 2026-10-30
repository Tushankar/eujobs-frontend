import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/* One row per send attempt; no body is stored (§2.8). */
const emailLogSchema = new Schema(
  {
    type: { type: String, enum: ENUMS.emailType, required: true },
    class: { type: String, enum: ENUMS.emailClass, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    to: { type: String, required: true },
    language: { type: String, enum: ENUMS.language },
    status: { type: String, enum: ENUMS.emailStatus, required: true },
    error: String,
  },
  { timestamps: true },
)
// The 24 h cap (OD9) counts by class; the per-address resend limits (M-001) count by recipient.
emailLogSchema.index({ class: 1, createdAt: 1 })
emailLogSchema.index({ to: 1, createdAt: -1 })

export const EmailLog = mongoose.model('EmailLog', emailLogSchema)
