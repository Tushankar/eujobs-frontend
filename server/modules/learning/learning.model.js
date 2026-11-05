import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'

const { Schema } = mongoose

/*
 * Courses and enrollments (§4.2, §3.9). A course holds its lessons in order and its final quiz (M-101, M-104);
 * text lessons keep the Markdown and its sanitised HTML (M-102). Skill tags are { name, key } like job skills
 * (M-114). `lockedAt` is set by the first enrollment (M-108). Enrollment progress fields serve completion (U15).
 */
const skillSchema = new Schema({ name: String, key: String, standard: String }, { _id: false })

const lessonSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ENUMS.lessonType, required: true },
  videoFileId: { type: Schema.Types.ObjectId, ref: 'File' },
  durationSec: Number,
  textMarkdown: String,
  textHtml: String,
  documentFileId: { type: Schema.Types.ObjectId, ref: 'File' },
  url: String,
  isPreview: { type: Boolean, default: false },
  // M-113: video and PDF lessons are single-language with a language tag.
  contentLanguage: { type: String, enum: ENUMS.language },
})

const questionSchema = new Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ENUMS.questionType, required: true },
  options: [new Schema({ text: { type: String, required: true } })],
  correctOptionIds: [Schema.Types.ObjectId],
})

const courseSchema = new Schema(
  {
    audience: { type: String, enum: ENUMS.courseAudience, required: true },
    language: { type: String, enum: ENUMS.language, default: 'en' },
    title: { type: String, required: true },
    category: String,
    level: { type: String, enum: ENUMS.courseLevel },
    summary: String,
    about: String,
    lead: String,
    tagline: String,
    designedFor: String,
    outcomes: [String],
    coverFileId: { type: Schema.Types.ObjectId, ref: 'File' },
    skillTags: [skillSchema],
    pipelineCategory: { type: String, enum: ENUMS.stageCategory },
    isFree: { type: Boolean, default: false },
    prices: [{ _id: false, currency: String, amountMinor: Number }],
    status: { type: String, enum: ENUMS.courseStatus, default: 'draft' },
    lessons: [lessonSchema],
    quiz: {
      passMark: { type: Number, default: LIMITS.course.passMark.default },
      questions: [questionSchema],
    },
    lockedAt: Date,
    publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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
    lessons: [
      {
        _id: false,
        lessonId: Schema.Types.ObjectId,
        creditedSec: { type: Number, default: 0 },
        lastPositionSec: Number,
        lastHeartbeatAt: Date,
        completedAt: Date,
      },
    ],
    quizBestScore: Number,
    quizPassedAt: Date,
    completedAt: Date,
    certificateId: { type: Schema.Types.ObjectId, ref: 'Certificate' },
  },
  { timestamps: true },
)
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true })

/* M-104: every submitted attempt; the enrollment keeps the best score. */
const quizAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    answers: [{ _id: false, questionId: Schema.Types.ObjectId, optionIds: [Schema.Types.ObjectId] }],
    scorePercent: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
quizAttemptSchema.index({ userId: 1, courseId: 1 })

/*
 * M-105, U17, C18: a snapshot of the holder's name and the course title at issue, the PDF in the holder's language,
 * and the public status. A name change re-issues the PDF under the same code. `userId` is null for a tombstone.
 */
const certificateSchema = new Schema(
  {
    code: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    holderName: String,
    courseTitle: String,
    language: { type: String, enum: ENUMS.language },
    issuedAt: { type: Date, required: true },
    pdfFileId: { type: Schema.Types.ObjectId, ref: 'File' },
    status: { type: String, enum: ENUMS.certificateStatus, default: 'valid' },
    revokedAt: Date,
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    revokeReason: String,
  },
  { timestamps: true },
)
certificateSchema.index({ code: 1 }, { unique: true })
certificateSchema.index({ userId: 1 })

export const Course = mongoose.model('Course', courseSchema)
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema)
export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema)
export const Certificate = mongoose.model('Certificate', certificateSchema)
