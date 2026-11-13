import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/*
 * Reviews of the platform shown on the landing page (2026-11-13): one per user (an active candidate or an approved
 * recruiter), 1–5 stars and a short text. A new or edited review is pending until an admin approves it in Moderation.
 */
const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ENUMS.reviewStatus, default: 'pending' },
    submittedAt: { type: Date, required: true },
    decision: { by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, reason: String },
  },
  { timestamps: true },
)
reviewSchema.index({ status: 1, 'decision.at': -1 })

export const Review = mongoose.model('Review', reviewSchema)
