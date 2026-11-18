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

/* Email and phone codes (M-002 … M-004) and sign-in codes (`login`, 2026-11-18): 6 digits, stored hashed. */
const verificationCodeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['email', 'phone', 'login'], required: true },
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
    // The remembered browser this session signed in on (TrustedDevice), if any.
    deviceId: { type: Schema.Types.ObjectId, ref: 'TrustedDevice' },
  },
  { timestamps: true },
)
loginEventSchema.index({ userId: 1, createdAt: -1 })
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * DAY_SECONDS })

/*
 * Sign-in second step (owner 2026-11-18). A challenge is what a correct password earns when a second step is due:
 * `email` (a code to the account's address), `totp` (authenticator app or backup code) or `totp_setup` (an admin
 * without 2FA sets it up first). One use, 10 minutes, 5 wrong codes.
 */
const loginChallengeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['email', 'totp', 'totp_setup'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    attempts: { type: Number, default: 0 },
    pendingSecret: String,
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
  },
  { timestamps: true },
)
loginChallengeSchema.index({ userId: 1, createdAt: -1 })
// Kept an hour past expiry so failed app codes still count towards the per-account limit.
loginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 })

/* A browser that passed the second step: its random key (kept by the browser) is stored hashed, for 90 days. */
const trustedDeviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)
trustedDeviceSchema.index({ userId: 1 })
trustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const EmailToken = mongoose.model('EmailToken', emailTokenSchema)
export const LoginChallenge = mongoose.model('LoginChallenge', loginChallengeSchema)
export const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema)
export const LoginEvent = mongoose.model('LoginEvent', loginEventSchema)
export const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema)
