import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/*
 * Pipeline stages per company (M-069 … M-072, OD5). The default six are created when the company is first
 * approved (§3.12); Phase 6 adds applications and stage management. `nameKey` is the lower-cased name.
 */
const pipelineStageSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    category: { type: String, enum: ENUMS.stageCategory, required: true },
    order: { type: Number, required: true },
    isEntry: { type: Boolean, default: false },
    tone: { type: String, enum: ENUMS.stageTone, default: 'neutral' },
  },
  { timestamps: true },
)
pipelineStageSchema.index({ companyId: 1, nameKey: 1 }, { unique: true })

export const PipelineStage = mongoose.model('PipelineStage', pipelineStageSchema)
