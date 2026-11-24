import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { trackWrites } from '../../lib/writeVersions.js'
import { placeSchema } from '../candidates/candidates.model.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * One company per recruiter (M-145), created at onboarding step 2 (OQ-5). The legal name is checked in KYC;
 * the display name is public and defaults to it (M-146). `location.countryCode` is the company country
 * (EU 27 + UK, M-149). Onboarding steps are derived, not stored (P4-D2).
 */
const companySchema = new Schema(
  {
    ownerUserId: { type: ObjectId, ref: 'User', required: true, unique: true },
    legalName: { type: String, required: true },
    displayName: { type: String, required: true },
    website: String,
    businessEmail: String,
    // 2026-11-24: the sector's key (meta Sector) and, in `industry`, its English name; older companies keep the
    // industry they typed until they pick a sector.
    sector: String,
    industry: String,
    size: { type: String, enum: ENUMS.companySize },
    location: placeSchema,
    businessAddress: String,
    registrationDetails: String,
    description: String,
    logoFileId: ObjectId,
    verifiedAt: Date,
    submittedAt: Date,
    reviewHistory: [{ _id: false, decision: { type: String, enum: ENUMS.accountDecision }, reason: String, by: ObjectId, at: Date }],
    // M-189: the recruiter deleted their account; the display name and logo stay for past applications and threads.
    deletedAt: Date,
  },
  { timestamps: true },
)

/* KYC files (M-185): one per type, replaceable while onboarding is in progress or rejected. */
const kycDocumentSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ENUMS.kycDocType, required: true },
    fileId: ObjectId,
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
kycDocumentSchema.index({ companyId: 1 })

// Public caches read again after a write (perf 2026-11-24).
trackWrites(companySchema, 'Company')
export const Company = mongoose.model('Company', companySchema)
export const KycDocument = mongoose.model('KycDocument', kycDocumentSchema)
