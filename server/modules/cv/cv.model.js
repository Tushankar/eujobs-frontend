import mongoose from 'mongoose'

const { Schema } = mongoose
const { ObjectId, Mixed } = Schema.Types

/*
 * CV versions (M-027 … M-031, U18). Deleting a version deletes its file and sets `fileId` to null; the
 * record stays so its number is never reused (P3-D7) and applications can say "CV removed" (M-030).
 * The snapshot fields are filled by the paid AI features of Phase 9.
 */
const cvVersionSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    number: { type: Number, required: true },
    fileId: ObjectId,
    originalName: String,
    mime: String,
    size: Number,
    extractedText: String,
    noReadableText: { type: Boolean, default: false },
    snapshot: { role: String, years: Number, skills: [String] },
    pendingSnapshot: Mixed,
    drafts: [{ suggestions: Mixed, revisedSnapshot: Mixed, createdAt: Date }],
  },
  { timestamps: true },
)
cvVersionSchema.index({ userId: 1, number: 1 })

export const CvVersion = mongoose.model('CvVersion', cvVersionSchema)
