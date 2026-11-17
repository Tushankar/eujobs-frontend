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
    // 2026-11-17: skill names sent to OpenAI for a standard name (their own daily cap, lib/ai.js addStandardNames).
    skillNames: { type: Number, default: 0 },
    // 2026-11-17: today's uses of the features with their own daily limit (LIMITS.ai.usage.featureLimits), by kind.
    features: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
)
aiUsageSchema.index({ userId: 1, day: 1 }, { unique: true })

/*
 * 2026-11-17: every paid API call, per UTC day, provider, model (a Places SKU for Google), kind and user (null: no user,
 * e.g. embeddings or the public "Use my location"). Admin › AI & matching › Usage prices it with the admin's prices.
 */
const apiUsageSchema = new Schema({
  day: { type: String, required: true },
  provider: { type: String, enum: ['openai', 'places'], required: true },
  model: { type: String, required: true },
  kind: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  calls: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  // Transcription models billed by duration (whisper-1) report seconds instead of tokens.
  seconds: { type: Number, default: 0 },
})
apiUsageSchema.index({ day: 1, provider: 1, model: 1, kind: 1, userId: 1 }, { unique: true })

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
export const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema)
export const ExplanationFeedback = mongoose.model('ExplanationFeedback', explanationFeedbackSchema)
