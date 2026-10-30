import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/* One role per account (S). Fields of later phases (privacy, company, Stripe) are added with them. */
const userSchema = new Schema(
  {
    role: { type: String, enum: ENUMS.role, required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: String,
    fullName: { type: String, required: true, trim: true },
    jobTitle: String,
    status: { type: String, enum: ENUMS.userStatus, required: true },
    isOwner: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    // E.164; not unique (OD3)
    phone: { e164: String, verifiedAt: Date },
    language: { type: String, enum: ENUMS.language, default: 'en' },
    languageExplicit: { type: Boolean, default: false },
    pickerCountry: String,
    timezone: String,
    tokenVersion: { type: Number, default: 0 },
    legal: { termsVersion: String, privacyVersion: String, acceptedAt: Date },
    notifyEmail: { type: Boolean, default: true },
    // Candidates (M-187, A: candidate S54); enforced by discovery and matching from Phase 4.
    privacy: {
      discoverable: { type: Boolean, default: true },
      resumeVisible: { type: Boolean, default: false },
      matchingConsent: { type: Boolean, default: true },
    },
    onboardingCompletedAt: Date,
    adminAccess: {
      roleId: { type: Schema.Types.ObjectId, ref: 'AdminRole' },
      department: String,
      granted: [String],
      removed: [String],
    },
    lastLoginAt: Date,
  },
  { timestamps: true },
)

userSchema.index({ role: 1, status: 1 })

export const User = mongoose.model('User', userSchema)
