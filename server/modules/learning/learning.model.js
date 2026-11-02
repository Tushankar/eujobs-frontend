import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/*
 * Courses and enrollments (§4.2). Phase 5 needs only what a course purchase reads and writes (M-130, U24);
 * Phase 8 adds the content, quiz and progress fields.
 */
const courseSchema = new Schema(
  {
    audience: { type: String, enum: ENUMS.courseAudience, required: true },
    title: { type: String, required: true },
    isFree: { type: Boolean, default: false },
    prices: [{ _id: false, currency: String, amountMinor: Number }],
    status: { type: String, enum: ENUMS.courseStatus, default: 'draft' },
  },
  { timestamps: true },
)
courseSchema.index({ audience: 1, status: 1 })

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    source: { type: String, enum: ['free', 'purchase', 'seed'], required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true })

export const Course = mongoose.model('Course', courseSchema)
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema)
