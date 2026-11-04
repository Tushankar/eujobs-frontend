import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * Admin report snapshots (M-181 … M-183, U23): the CSV is stored once and "Download again" serves the same bytes.
 * `periodStart` and `periodEnd` are the period's dates in the admin's time zone when it was generated.
 */
const reportExportSchema = new Schema(
  {
    type: { type: String, enum: ENUMS.reportType, required: true },
    period: { type: String, enum: ENUMS.reportPeriod, required: true },
    periodStart: String,
    periodEnd: String,
    timeZone: String,
    language: { type: String, enum: ENUMS.language, required: true },
    brief: String,
    voiceFileId: { type: ObjectId, ref: 'File' },
    voiceFileName: String,
    transcript: String,
    aiSummary: String,
    csvFileId: { type: ObjectId, ref: 'File', required: true },
    filename: { type: String, required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    createdByName: String,
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
)
reportExportSchema.index({ generatedAt: -1 })

export const ReportExport = mongoose.model('ReportExport', reportExportSchema)
