import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * Content cases (M-164, M-167, U20, OQ-1). One open case per target: later reports join it. `targetName` is the
 * name shown in the queue, kept as it was when the case opened. `ownerId` is the account emailed about a decision
 * (the job's company owner or the candidate). A message case keeps the reported message and up to 5 earlier ones.
 */
const reportSchema = new Schema(
  {
    reporterId: { type: ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ENUMS.reportReason, required: true },
    details: String,
    at: { type: Date, required: true },
  },
  { _id: false },
)

const stepSchema = new Schema(
  {
    action: { type: String, enum: ['opened', 'dismissed', 'restricted', 'lifted'], required: true },
    reason: String,
    photoRemoved: Boolean,
    by: ObjectId,
    byName: String,
    at: { type: Date, required: true },
  },
  { _id: false },
)

const caseSchema = new Schema(
  {
    targetType: { type: String, enum: ENUMS.reportTargetType, required: true },
    targetId: { type: ObjectId, required: true },
    targetName: String,
    ownerId: { type: ObjectId, ref: 'User' },
    reports: [reportSchema],
    excerpt: [{ _id: false, senderRole: String, body: String, at: Date, reported: Boolean }],
    status: { type: String, enum: ENUMS.caseStatus, default: 'open' },
    decision: { action: String, reason: String, by: ObjectId, at: Date },
    history: [stepSchema],
    openedBy: { type: String, enum: ['user', 'admin'], required: true },
  },
  { timestamps: true },
)
caseSchema.index({ status: 1, createdAt: -1 })
caseSchema.index({ targetType: 1, targetId: 1 })
caseSchema.index({ 'reports.reporterId': 1, 'reports.at': -1 })

export const ModerationCase = mongoose.model('ModerationCase', caseSchema)
