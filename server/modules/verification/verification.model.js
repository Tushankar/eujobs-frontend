import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * Evidence submissions (M-166). `entryId` links the profile entry the evidence supports (identity links
 * the account name, so it has none). `resetAt` marks a submission whose entry was edited or deleted
 * (U27): it no longer counts, and the candidate may submit again (P3-D8).
 */
const submissionSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    category: { type: String, enum: ENUMS.verificationCategory, required: true },
    evidenceType: { type: String, enum: ENUMS.evidenceType },
    fileId: ObjectId,
    entryId: ObjectId,
    status: { type: String, enum: ENUMS.verificationStatus, default: 'in_review' },
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: ObjectId, ref: 'User' },
    reviewedAt: Date,
    reason: String,
    previousSubmissionId: ObjectId,
    resetAt: Date,
  },
  { timestamps: true },
)
submissionSchema.index({ status: 1, submittedAt: 1 })
submissionSchema.index({ userId: 1, category: 1 })

export const VerificationSubmission = mongoose.model('VerificationSubmission', submissionSchema)
