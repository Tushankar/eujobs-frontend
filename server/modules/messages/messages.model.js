import mongoose from 'mongoose'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

const SIDES = ['candidate', 'recruiter']
const perSide = (type, defaultValue) => ({ candidate: { type, default: defaultValue }, recruiter: { type, default: defaultValue } })

/*
 * One thread per company and candidate (M-086), optionally tagged with a job. `unread` counts the messages each side
 * has not read; `lastEmailAt` is when each side was last emailed about this thread (M-089, U13).
 */
const conversationSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    jobId: { type: ObjectId, ref: 'Job' },
    startedBy: { type: String, enum: SIDES, required: true },
    lastMessageAt: Date,
    lastMessagePreview: String,
    unread: perSide(Number, 0),
    lastEmailAt: perSide(Date),
    // The other side deleted their account (P12-Q2, M-189): the thread stays listed, replies are refused.
    closedAt: Date,
  },
  { timestamps: true },
)
conversationSchema.index({ companyId: 1, candidateId: 1 }, { unique: true })
conversationSchema.index({ candidateId: 1, lastMessageAt: -1 })
conversationSchema.index({ companyId: 1, lastMessageAt: -1 })

/* Text only, no attachments (M-086). */
const messageSchema = new Schema(
  {
    conversationId: { type: ObjectId, ref: 'Conversation', required: true },
    senderId: { type: ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: SIDES, required: true },
    body: { type: String, required: true },
    readAt: Date,
  },
  { timestamps: true },
)
messageSchema.index({ conversationId: 1, createdAt: 1 })

export const Conversation = mongoose.model('Conversation', conversationSchema)
export const Message = mongoose.model('Message', messageSchema)
