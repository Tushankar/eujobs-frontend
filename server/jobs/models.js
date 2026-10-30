import mongoose from 'mongoose'
import { ENUMS } from '../config/enums.js'

const { Schema } = mongoose

/* Due records for the in-process scheduler (OD10, §2.7). A pending key is unique, so scheduling collapses. */
const scheduledTaskSchema = new Schema(
  {
    type: { type: String, enum: ENUMS.taskType, required: true },
    key: { type: String, required: true },
    dueAt: { type: Date, required: true },
    payload: Schema.Types.Mixed,
    status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    lastError: String,
    lockedAt: Date,
  },
  { timestamps: true },
)
scheduledTaskSchema.index({ status: 1, dueAt: 1 })
scheduledTaskSchema.index({ key: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })

/* Daily slots (relevance-nightly, retention-sweep): when each last ran. */
const jobRunSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    lastRunAt: Date,
  },
  { timestamps: true },
)

export const ScheduledTask = mongoose.model('ScheduledTask', scheduledTaskSchema)
export const JobRun = mongoose.model('JobRun', jobRunSchema)
