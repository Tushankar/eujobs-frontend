import mongoose from 'mongoose'

const { Schema } = mongoose
const DAY_SECONDS = 24 * 60 * 60

/* Email links (M-001, M-009, U21): random token, stored as a SHA-256 hash, single use. */
const emailTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['verify_email', 'reset_password', 'admin_invite'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true },
)
// Kept 7 days past expiry so an expired link still answers TOKEN_EXPIRED.
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * DAY_SECONDS })

/* Email and phone codes (M-002 … M-004): 6 digits, stored hashed. */
const verificationCodeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['email', 'phone'], required: true },
    target: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, required: true },
    consumedAt: Date,
  },
  { timestamps: true },
)
verificationCodeSchema.index({ userId: 1, channel: 1 })
// Kept one hour past expiry so the 5-per-hour resend limit can count them.
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 })

/*
 * Sign-ins (owner 2026-11-18): a successful one is a session (its id is the JWT's `sid`), a failed one only history.
 * Deleted 90 days after the sign-in; tokens live 7 days, so no live session is lost.
 */
const loginEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outcome: { type: String, enum: ['success', 'failed'], required: true },
    // The account's tokenVersion at sign-in: a later reset or "sign out of all other devices" ends the session.
    tv: Number,
    expiresAt: Date,
    lastSeenAt: Date,
    revokedAt: Date,
    ip: String,
    browser: String,
    browserVersion: String,
    os: String,
    deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
    city: String,
    country: String,
  },
  { timestamps: true },
)
loginEventSchema.index({ userId: 1, createdAt: -1 })
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * DAY_SECONDS })

export const EmailToken = mongoose.model('EmailToken', emailTokenSchema)
export const LoginEvent = mongoose.model('LoginEvent', loginEventSchema)
export const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema)
