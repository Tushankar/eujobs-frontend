import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * Interviews (§3.23, P11d-Q1 … Q29): one record per offer of a company to a candidate for one application. A
 * reschedule reopens the same record with new slots and raises `sequence` (the calendar invite's SEQUENCE). Times are
 * UTC. `consent` holds each side's on-screen answer to AI notes (null: not asked yet). `notes` and `transcript` are
 * company-only and go 6 months after the application closes; `outcome` stays.
 */
const slotSchema = new Schema({ startAt: { type: Date, required: true }, minutes: { type: Number, enum: LIMITS.interviews.minutes, required: true } }, { _id: false })

const interviewSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    applicationId: { type: ObjectId, ref: 'Application', required: true },
    jobId: { type: ObjectId, ref: 'Job', required: true },
    conversationId: { type: ObjectId, ref: 'Conversation', required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ENUMS.interviewStatus, default: 'offered' },
    mode: { type: String, enum: ENUMS.interviewMode, required: true },
    address: String,
    link: String,
    aiNotes: { type: Boolean, default: false },
    slots: [slotSchema],
    startAt: Date,
    minutes: Number,
    sequence: { type: Number, default: 0 },
    // The candidate's "other times" note (status other_times) and "ask to reschedule" note (a confirmed booking stays).
    otherTimesNote: String,
    rescheduleRequest: { note: String, at: Date },
    cancelReason: String,
    confirmedAt: Date,
    cancelledAt: Date,
    joined: { recruiter: Date, candidate: Date },
    consent: { recruiter: { type: Boolean, default: null }, candidate: { type: Boolean, default: null } },
    recording: {
      status: { type: String, enum: ENUMS.recordingStatus, default: 'off' },
      startedAt: Date,
      stoppedAt: Date,
      stoppedBy: { type: String, enum: ['candidate', 'recruiter', 'system'] },
      fileId: { type: ObjectId, ref: 'File' },
      bytes: { type: Number, default: 0 },
      nextSeq: { type: Number, default: 0 },
    },
    notes: {
      language: String,
      summary: String,
      keyAnswers: [String],
      strengths: [String],
      concerns: [String],
      followUps: [String],
      generatedAt: Date,
    },
    transcript: String,
    outcome: {
      result: { type: String, enum: ENUMS.interviewOutcome },
      note: String,
      at: Date,
      by: ObjectId,
    },
    // The 6-month sweep ran (P11d-Q8): notes, transcript and audio are gone.
    purgedAt: Date,
  },
  { timestamps: true },
)
interviewSchema.index({ companyId: 1, status: 1, startAt: 1 })
interviewSchema.index({ candidateId: 1, status: 1, startAt: 1 })
interviewSchema.index({ applicationId: 1 })
interviewSchema.index({ conversationId: 1 })

/*
 * A document request card (§3.23, P11d-Q7, Q19 … Q21): items the candidate answers with one file each (replaceable)
 * or a declined note, until the recruiter marks it complete. `fileId` of the recruiter's optional attachment.
 */
const itemSchema = new Schema({
  kind: { type: String, enum: ENUMS.documentKind, required: true },
  label: String,
  fileId: { type: ObjectId, ref: 'File' },
  uploadedAt: Date,
  declineNote: String,
  declinedAt: Date,
})

const documentRequestSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    applicationId: { type: ObjectId, ref: 'Application', required: true },
    jobId: { type: ObjectId, ref: 'Job', required: true },
    conversationId: { type: ObjectId, ref: 'Conversation', required: true },
    requestedBy: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ENUMS.documentRequestStatus, default: 'open' },
    items: [itemSchema],
    note: String,
    attachmentFileId: { type: ObjectId, ref: 'File' },
    completedAt: Date,
    // Every item was answered once: the recruiter's "documents received" went out.
    answeredAt: Date,
    purgedAt: Date,
  },
  { timestamps: true },
)
documentRequestSchema.index({ conversationId: 1 })
documentRequestSchema.index({ applicationId: 1 })
documentRequestSchema.index({ candidateId: 1 })

export const Interview = mongoose.model('Interview', interviewSchema)
export const DocumentRequest = mongoose.model('DocumentRequest', documentRequestSchema)
