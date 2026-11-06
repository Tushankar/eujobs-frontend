import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/* One role per account (S). Fields of later phases are added with them. */
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
    // P11b-Q3, Q12: the email categories this user switched off (EMAIL_CATEGORIES); every category is on by default.
    emailOff: { type: [{ type: String, enum: ENUMS.emailCategory }], default: undefined },
    // Candidates (M-187, A: candidate S54); enforced by discovery and matching from Phase 4.
    privacy: {
      discoverable: { type: Boolean, default: true },
      resumeVisible: { type: Boolean, default: false },
      matchingConsent: { type: Boolean, default: true },
    },
    onboardingCompletedAt: Date,
    // The first-login product tour (candidates, recruiters): set when it is finished or skipped.
    tourFinishedAt: Date,
    // Recruiters (M-145)
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    adminAccess: {
      roleId: { type: Schema.Types.ObjectId, ref: 'AdminRole' },
      department: String,
      granted: [String],
      removed: [String],
    },
    // Stripe customer, created at the first checkout (§2.10)
    stripeCustomerId: String,
    lastLoginAt: Date,
    // Set while DELETE /me runs: late Stripe webhooks for this account are ignored (privacy.erase.js).
    erasedAt: Date,
  },
  { timestamps: true },
)

userSchema.index({ role: 1, status: 1 })

export const User = mongoose.model('User', userSchema)
