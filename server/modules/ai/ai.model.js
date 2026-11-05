import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/* Generated AI output (§2.9, M-058): one entry per kind, input hash (with the entity version) and language. */
const aiCacheSchema = new Schema(
  {
    kind: { type: String, enum: ENUMS.aiKind, required: true },
    key: { type: String, required: true },
    language: { type: String, enum: ENUMS.language, required: true },
    output: Schema.Types.Mixed,
    model: String,
    // The candidate the text is about (null when it is about a job, company or course), so erasure finds it (M-188).
    subjectId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
)
aiCacheSchema.index({ kind: 1, key: 1, language: 1 }, { unique: true })
aiCacheSchema.index({ subjectId: 1 })

/* OD13: counted generations per user and UTC day. */
const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
)
aiUsageSchema.index({ userId: 1, day: 1 }, { unique: true })

/* M-067: one "Helpful" or "Needs review" per candidate and job, aggregated for admins. */
const explanationFeedbackSchema = new Schema(
  {
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    value: { type: String, enum: ['helpful', 'needs_review'], required: true },
  },
  { timestamps: true },
)
explanationFeedbackSchema.index({ candidateId: 1, jobId: 1 }, { unique: true })

export const AiCache = mongoose.model('AiCache', aiCacheSchema)
export const AiUsage = mongoose.model('AiUsage', aiUsageSchema)
export const ExplanationFeedback = mongoose.model('ExplanationFeedback', explanationFeedbackSchema)
