import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { trackWrites } from '../../lib/writeVersions.js'

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
    // Owner 2026-11-16: unset until the account picks one with the theme button.
    theme: { type: String, enum: ENUMS.theme },
    pickerCountry: String,
    // Owner 2026-11-19: the account's default country, pinned in the header picker. Set at sign-up, onboarding and by
    // the company location; picking a country in the header changes only pickerCountry.
    homeCountry: String,
    // Candidates (owner 2026-11-16): false once they pick Remote or a country to browse; unset or true = Worldwide.
    jobsWorldwide: Boolean,
    timezone: String,
    tokenVersion: { type: Number, default: 0 },
    // Authenticator-app 2FA (owner 2026-11-18; required for admins): encrypted secret (lib/totp.js), the last code's
    // time step (a code works once), a secret waiting for its first code, and hashed one-time backup codes.
    twoFactor: {
      secret: String,
      enabledAt: Date,
      lastStep: Number,
      pendingSecret: String,
      backupCodes: { type: [{ hash: String, usedAt: Date }], default: undefined },
    },
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
    // 2026-11-17: success modals waiting to be seen once (modules/users/celebrations.js).
    celebrations: [{ kind: { type: String, required: true }, params: Schema.Types.Mixed, at: Date }],
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

// Public caches read again after a write (perf 2026-11-24).
trackWrites(userSchema, 'User')
export const User = mongoose.model('User', userSchema)
