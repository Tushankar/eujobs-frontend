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
  },
  { timestamps: true },
)
aiCacheSchema.index({ kind: 1, key: 1, language: 1 }, { unique: true })

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

export const AiCache = mongoose.model('AiCache', aiCacheSchema)
export const AiUsage = mongoose.model('AiUsage', aiUsageSchema)
