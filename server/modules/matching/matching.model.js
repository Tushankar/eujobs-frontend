import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/* U6: one vector per candidate (user id) or job, as a Float32 buffer (about 12 KB at 3072 dims). */
const embeddingSchema = new Schema(
  {
    ownerType: { type: String, enum: ['candidate', 'job'], required: true },
    ownerId: { type: ObjectId, required: true },
    model: { type: String, required: true },
    dims: { type: Number, required: true },
    vector: { type: Buffer, required: true },
    sourceHash: { type: String, required: true },
  },
  { timestamps: true },
)
embeddingSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true })
// seed:demo reuses the vector of an unchanged text (same model and hash) instead of calling OpenAI again.
embeddingSchema.index({ sourceHash: 1 })

const signals = { _id: false, skills: Boolean, experience: Boolean, location: Boolean }
const weights = { _id: false, sim: Number, skill: Number }
const thresholds = { _id: false, strong: Number, good: Number }

/* M-048, M-049, U5: one global active policy; drafts can be archived; every signal save is a new version. */
const policySchema = new Schema(
  {
    name: { type: String, required: true },
    nameLower: { type: String, required: true, unique: true },
    description: String,
    status: { type: String, enum: ENUMS.policyStatus, default: 'draft' },
    signals,
    weights,
    thresholds,
    version: { type: Number, default: 1 },
    versionId: ObjectId,
    activatedAt: Date,
    createdBy: ObjectId,
  },
  { timestamps: true },
)
policySchema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } })

const policyVersionSchema = new Schema(
  {
    policyId: { type: ObjectId, ref: 'MatchingPolicy', required: true },
    version: { type: Number, required: true },
    signals,
    weights,
    thresholds,
    createdBy: ObjectId,
  },
  { timestamps: true },
)
policyVersionSchema.index({ policyId: 1, version: 1 }, { unique: true })

/* M-047, M-051: the score of one job and candidate under the active policy version. */
const matchResultSchema = new Schema(
  {
    jobId: { type: ObjectId, ref: 'Job', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    policyVersionId: { type: ObjectId, required: true },
    score: { type: Number, required: true },
    // null below Good (M-047)
    label: { type: String, enum: ENUMS.matchLabel },
    sim: Number,
    skillShare: Number,
    locationCapped: Boolean,
    matchedSkills: [String],
    missingSkills: [String],
    computedAt: Date,
  },
  { timestamps: true },
)
matchResultSchema.index({ jobId: 1, candidateId: 1 }, { unique: true })
matchResultSchema.index({ jobId: 1, score: -1 })
matchResultSchema.index({ candidateId: 1 })

export const Embedding = mongoose.model('Embedding', embeddingSchema)
export const MatchingPolicy = mongoose.model('MatchingPolicy', policySchema)
export const MatchingPolicyVersion = mongoose.model('MatchingPolicyVersion', policyVersionSchema)
export const MatchResult = mongoose.model('MatchResult', matchResultSchema)
