import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { placeSchema } from '../candidates/candidates.model.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * Job alerts (§3.6, M-096 … M-098, U35, G-1). `country` is the picker country when the alert was created (Remote
 * allowed) and `language` the user's language then, used for the translated labels. `lastDigestAt` is when the
 * last daily or weekly digest was evaluated (U12).
 */
const jobAlertSchema = new Schema(
  {
    candidateId: { type: ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    keywords: { type: String, required: true },
    location: { type: placeSchema, default: null },
    country: { type: String, required: true },
    language: { type: String, enum: ENUMS.language, required: true },
    frequency: { type: String, enum: ENUMS.alertFrequency, required: true },
    active: { type: Boolean, default: true },
    lastDigestAt: Date,
  },
  { timestamps: true },
)
jobAlertSchema.index({ frequency: 1, active: 1 })
jobAlertSchema.index({ candidateId: 1, createdAt: -1 })

/* A job is sent once per alert, instantly or in a digest (M-097, U12). */
const alertMatchSchema = new Schema(
  {
    alertId: { type: ObjectId, ref: 'JobAlert', required: true },
    jobId: { type: ObjectId, ref: 'Job', required: true },
    mode: { type: String, enum: ['instant', 'digest'], required: true },
    sentAt: { type: Date, required: true },
  },
  { timestamps: true },
)
alertMatchSchema.index({ alertId: 1, jobId: 1 }, { unique: true })

export const JobAlert = mongoose.model('JobAlert', jobAlertSchema)
export const AlertMatch = mongoose.model('AlertMatch', alertMatchSchema)
