import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/* Uploaded and generated files (M-185, U39). `path` is relative to the upload root; `deleteAfter` drives retention (M-186). */
const fileSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ENUMS.filePurpose, required: true },
    path: { type: String, required: true },
    originalName: String,
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: String,
    deleteAfter: Date,
  },
  { timestamps: true },
)
fileSchema.index({ ownerId: 1, purpose: 1 })
fileSchema.index({ deleteAfter: 1 })

/* A CV served to someone other than its owner (M-187); the candidate sees the list. */
const fileAccessLogSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accessorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: Schema.Types.ObjectId,
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
fileAccessLogSchema.index({ ownerId: 1, at: -1 })

export const File = mongoose.model('File', fileSchema)
export const FileAccessLog = mongoose.model('FileAccessLog', fileAccessLogSchema)
