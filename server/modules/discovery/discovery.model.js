import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/* One shortlist per company (M-079); the candidate is not notified. */
const shortlistEntrySchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    addedBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
shortlistEntrySchema.index({ companyId: 1, candidateId: 1 }, { unique: true })

/* One private note per company and candidate (M-080). */
/*
 * M-080 (owner decision 2026-11-05): a company's private notes on a candidate, one document per note, seen by the whole
 * company and changed only by their author. `context` keeps the stage and job the note was written in (from the Hiring
 * pipeline), as they were then. `editedAt` marks a changed note.
 */
const candidateNoteSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    authorId: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    context: {
      applicationId: { type: ObjectId, ref: 'Application' },
      jobTitle: String,
      stageName: String,
    },
    editedAt: Date,
  },
  { timestamps: true },
)
candidateNoteSchema.index({ companyId: 1, candidateId: 1, createdAt: -1 })

/* The company-wide timeline per candidate (M-081): type + params, translated by the client. No actor = the candidate. */
const recruiterActivitySchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    actorId: { type: ObjectId, ref: 'User' },
    type: { type: String, enum: ENUMS.activityType, required: true },
    params: Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
recruiterActivitySchema.index({ companyId: 1, candidateId: 1, at: -1 })

/* M-184: one view per approved recruiter per UTC day. */
const profileViewSchema = new Schema(
  {
    candidateId: { type: ObjectId, ref: 'User', required: true },
    recruiterId: { type: ObjectId, ref: 'User', required: true },
    companyId: { type: ObjectId, ref: 'Company', required: true },
    day: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
profileViewSchema.index({ candidateId: 1, recruiterId: 1, day: 1 }, { unique: true })

export const ShortlistEntry = mongoose.model('ShortlistEntry', shortlistEntrySchema)
export const CandidateNote = mongoose.model('CandidateNote', candidateNoteSchema)
export const RecruiterActivity = mongoose.model('RecruiterActivity', recruiterActivitySchema)
export const ProfileView = mongoose.model('ProfileView', profileViewSchema)
