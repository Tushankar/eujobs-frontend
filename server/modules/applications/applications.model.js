import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * Pipeline stages per company (M-069 … M-072, OD5). The default six are created when the company is first
 * approved (§3.12). `nameKey` is the lower-cased name.
 */
const pipelineStageSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    category: { type: String, enum: ENUMS.stageCategory, required: true },
    order: { type: Number, required: true },
    isEntry: { type: Boolean, default: false },
    tone: { type: String, enum: ENUMS.stageTone, default: 'neutral' },
  },
  { timestamps: true },
)
pipelineStageSchema.index({ companyId: 1, nameKey: 1 }, { unique: true })

/*
 * One application per candidate and job (M-069, M-074). History keeps dated steps with the stage name as it was
 * (M-075); `lastEmailedStatus` is the last status the candidate was told (U13, U33) and `rejectNotify` the
 * recruiter's choice for the pending rejection email (M-090). `recruiterNotified` marks the applications already
 * counted in a "new applications" email (OD14).
 */
const historyEntrySchema = new Schema(
  {
    status: { type: String, enum: ENUMS.applicationStatus, required: true },
    stageId: ObjectId,
    stageName: String,
    category: { type: String, enum: ENUMS.stageCategory },
    at: { type: Date, required: true },
    actorId: ObjectId,
    actorType: { type: String, enum: ['candidate', 'recruiter'], required: true },
  },
  { _id: false },
)

const ACTIVE_STATUSES = ENUMS.applicationStatus.filter((status) => status !== 'withdrawn')

const applicationSchema = new Schema(
  {
    candidateId: { type: ObjectId, ref: 'User', required: true },
    jobId: { type: ObjectId, ref: 'Job', required: true },
    companyId: { type: ObjectId, ref: 'Company', required: true },
    status: { type: String, enum: ENUMS.applicationStatus, default: 'applied' },
    stageId: { type: ObjectId, ref: 'PipelineStage', required: true },
    cvVersionId: { type: ObjectId, ref: 'CvVersion' },
    coverNote: String,
    consentAt: { type: Date, required: true },
    appliedAt: { type: Date, required: true },
    withdrawnAt: Date,
    notSelectedAt: Date,
    history: [historyEntrySchema],
    lastEmailedStatus: { type: String, enum: ENUMS.applicationStatus, default: 'applied' },
    rejectNotify: { type: Boolean, default: false },
    recruiterNotified: { type: Boolean, default: false },
  },
  { timestamps: true },
)
// M-074: only withdrawn records leave the one-per-job rule.
applicationSchema.index({ candidateId: 1, jobId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ACTIVE_STATUSES } } })
applicationSchema.index({ companyId: 1, status: 1 })
applicationSchema.index({ jobId: 1, status: 1 })
applicationSchema.index({ candidateId: 1, appliedAt: -1 })

/** An application is active until it is withdrawn or not selected (M-082, M-094). */
export const ACTIVE_FILTER = { status: { $nin: ['withdrawn', 'not_selected'] } }

export const PipelineStage = mongoose.model('PipelineStage', pipelineStageSchema)
export const Application = mongoose.model('Application', applicationSchema)
