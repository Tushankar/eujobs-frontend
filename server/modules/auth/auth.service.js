import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { sendEmail } from '../../lib/mailer.js'
import { EmailLog } from '../../lib/mail/emailLog.model.js'
import { currentLegalVersions, findEnabledCountry } from '../meta/meta.service.js'
import { User } from '../users/users.model.js'
import { EmailToken, VerificationCode } from './auth.model.js'

const BCRYPT_COST = 12
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const SIGN_IN_PATH = { candidate: '/sign-in', recruiter: '/recruiter/sign-in', admin: '/admin/sign-in' }

// Top 10,000 passwords (P10), compared case-insensitively.
const COMMON_PASSWORDS = new Set(
  readFileSync(new URL('../../data/common-passwords.txt', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((password) => password.toLowerCase()),
)

/* ---------- passwords and tokens ---------- */

/** M-006, U2: 8–128 characters, at most 72 bytes, not a common password, not the email local part. */
export function checkPassword(password, email, field = 'password') {
  const { min, max, maxBytes } = LIMITS.password
  if (password.length < min) throw fieldError({ [field]: 'too_short' }, { min })
  if (password.length > max) throw fieldError({ [field]: 'too_long' }, { max })
  if (Buffer.byteLength(password) > maxBytes) throw fieldError({ [field]: 'too_long' }, { maxBytes })
  if (COMMON_PASSWORDS.has(password.toLowerCase())) throw fieldError({ [field]: 'too_common' })
  if (password.toLowerCase() === email.split('@')[0].toLowerCase()) throw fieldError({ [field]: 'matches_email' })
}

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST)

let dummyHash
/** Compares against a dummy hash when there is no account, so both paths take the same time. */
async function passwordMatches(user, password) {
  if (user?.passwordHash) return bcrypt.compare(password, user.passwordHash)
  dummyHash ??= await hashPassword('no-account-placeholder')
  await bcrypt.compare(password, dummyHash)
  return false
}

export function signToken(user) {
  return jwt.sign({ role: user.role, tv: user.tokenVersion }, config.jwt.secret, {
    subject: String(user._id),
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256',
  })
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

async function issueEmailToken(userId, purpose, ttlMs) {
  const raw = randomBytes(32).toString('base64url')
  await EmailToken.create({ userId, purpose, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) })
  return raw
}

async function findEmailToken(raw, purpose) {
  const token = await EmailToken.findOne({ tokenHash: sha256(raw), purpose })
  if (!token) throw new AppError('TOKEN_INVALID')
  if (token.usedAt) throw new AppError('TOKEN_USED')
  if (token.expiresAt < new Date()) throw new AppError('TOKEN_EXPIRED')
  return token
}

async function useEmailToken(token) {
  const claimed = await EmailToken.findOneAndUpdate({ _id: token._id, usedAt: null }, { usedAt: new Date() })
  if (!claimed) throw new AppError('TOKEN_USED')
}

/* ---------- codes (email now, phone in later phases) ---------- */

const hashCode = (userId, code) => sha256(`${userId}:${code}`)

/** Throws RATE_LIMITED unless 60 s passed since the last code and fewer than 5 went out this hour (M-004). */
export async function assertCodeResendAllowed(userId, channel) {
  const { resendAfterMs, maxPerHour } = LIMITS.code
  const now = Date.now()
  const recent = await VerificationCode.find({ userId, channel, sentAt: { $gte: new Date(now - HOUR_MS) } }, 'sentAt')
    .sort({ sentAt: -1 })
    .limit(maxPerHour)
  let opensAt = 0
  if (recent[0]) opensAt = recent[0].sentAt.getTime() + resendAfterMs
  if (recent.length >= maxPerHour) opensAt = Math.max(opensAt, recent[maxPerHour - 1].sentAt.getTime() + HOUR_MS)
  if (opensAt > now) throw new AppError('RATE_LIMITED', { params: { retryAfter: Math.ceil((opensAt - now) / 1000) } })
}

export async function issueCode(userId, channel, target) {
  const code = String(randomInt(0, 10 ** LIMITS.code.length)).padStart(LIMITS.code.length, '0')
  const now = Date.now()
  await VerificationCode.create({
    userId,
    channel,
    target,
    codeHash: hashCode(userId, code),
    sentAt: new Date(now),
    expiresAt: new Date(now + LIMITS.code.ttlMs),
  })
  return code
}

/** Checks the latest code: expired → CODE_EXPIRED; 5 wrong attempts lock it (M-004). */
export async function verifyCode(userId, channel, code) {
  const { maxAttempts } = LIMITS.code
  const record = await VerificationCode.findOne({ userId, channel, consumedAt: null }).sort({ sentAt: -1 })
  if (!record || record.expiresAt < new Date()) throw new AppError('CODE_EXPIRED')
  if (record.attempts >= maxAttempts) throw new AppError('CODE_LOCKED', { params: { attemptsLeft: 0 } })
  const matches = timingSafeEqual(Buffer.from(record.codeHash), Buffer.from(hashCode(userId, code)))
  if (!matches) {
    const { attempts } = await VerificationCode.findByIdAndUpdate(record._id, { $inc: { attempts: 1 } }, { returnDocument: 'after' })
    const attemptsLeft = maxAttempts - attempts
    throw new AppError(attemptsLeft > 0 ? 'CODE_INVALID' : 'CODE_LOCKED', { params: { attemptsLeft: Math.max(attemptsLeft, 0) } })
  }
  record.consumedAt = new Date()
  await record.save()
}

/* ---------- emails ---------- */

/** Verification and "already registered" emails share 1 per minute and 5 per day per address (M-001, U36). */
async function verifySendAllowed(to) {
  const { perMinute, perDay } = LIMITS.verifyEmailSends
  const now = Date.now()
  const sends = await EmailLog.find(
    { to, type: { $in: ['verify_email', 'already_registered'] }, createdAt: { $gte: new Date(now - DAY_MS) } },
    'createdAt',
  ).sort({ createdAt: -1 })
  const lastMinute = sends.filter((send) => send.createdAt.getTime() > now - MINUTE_MS).length
  return sends.length < perDay && lastMinute < perMinute
}

async function sendVerifyEmail(user) {
  if (!(await verifySendAllowed(user.email))) return
  const token = await issueEmailToken(user._id, 'verify_email', LIMITS.emailLink.verifyTtlMs)
  await sendEmail({
    type: 'verify_email',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, link: `${config.clientOrigin}/verify-email?token=${token}` },
  })
}

async function sendEmailCode(user) {
  const code = await issueCode(user._id, 'email', user.email)
  await sendEmail({
    type: 'recruiter_email_code',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, code },
  })
}

/* ---------- registration ---------- */

export function normalizePhone(phone, country) {
  const parsed = parsePhoneNumberFromString(phone, country === 'REMOTE' ? undefined : country)
  if (!parsed?.isValid()) throw fieldError({ phone: 'invalid' })
  return parsed.number
}

async function newAccountFields(input) {
  checkPassword(input.password, input.email)
  await findEnabledCountry(input.country)
  return {
    email: input.email,
    passwordHash: await hashPassword(input.password),
    fullName: input.fullName,
    language: input.language,
    languageExplicit: input.languageExplicit,
    pickerCountry: input.country,
    timezone: input.timezone,
    legal: { ...(await currentLegalVersions()), acceptedAt: new Date() },
  }
}

/**
 * M-001, U36: no token; the same reply for a duplicate, whose owner gets "already registered"
 * (in the sign-up language) instead. Admin addresses get nothing (OD6).
 */
export async function registerCandidate(input) {
  const fields = await newAccountFields(input)
  const existing = await User.findOne({ email: fields.email })
  if (existing) {
    if (existing.role !== 'admin' && (await verifySendAllowed(existing.email))) {
      await sendEmail({
        type: 'already_registered',
        to: existing.email,
        userId: existing._id,
        language: input.language,
        params: {
          name: existing.fullName,
          link: `${config.clientOrigin}${SIGN_IN_PATH[existing.role]}`,
          secondaryLink: `${config.clientOrigin}/forgot-password`,
        },
      })
    }
    return
  }
  const user = await User.create({ ...fields, role: 'candidate', status: 'unverified' })
  await sendVerifyEmail(user)
}

/** U37, OQ-6h: returns the new user (a token is issued); a registered email is EMAIL_TAKEN. */
export async function registerRecruiter(input) {
  const fields = await newAccountFields(input)
  const phone = normalizePhone(input.phone, input.country)
  if (await User.exists({ email: fields.email })) throw new AppError('EMAIL_TAKEN')
  const user = await User.create({ ...fields, role: 'recruiter', status: 'unverified', jobTitle: input.jobTitle, phone: { e164: phone } })
  await sendEmailCode(user)
  return user
}

/* ---------- sign-in, verification, reset ---------- */

/** M-005: one login; the admin portal is for admins only and admins sign in only there. */
export async function login({ email, password, portal, timezone }) {
  const user = await User.findOne({ email })
  if (!(await passwordMatches(user, password))) throw new AppError('INVALID_CREDENTIALS')
  if ((portal === 'admin') !== (user.role === 'admin')) throw new AppError('INVALID_CREDENTIALS')
  if (user.role === 'candidate' && user.status === 'unverified') throw new AppError('EMAIL_UNVERIFIED')
  user.lastLoginAt = new Date()
  if (timezone) user.timezone = timezone
  await user.save()
  return user
}

/** Marks the email verified and moves the first state forward (§3.1). */
function markEmailVerified(user) {
  user.emailVerifiedAt ??= new Date()
  if (user.status === 'unverified') user.status = user.role === 'candidate' ? 'active' : 'onboarding'
}

export async function verifyEmailLink(raw) {
  const token = await findEmailToken(raw, 'verify_email')
  await useEmailToken(token)
  const user = await User.findById(token.userId)
  markEmailVerified(user)
  await user.save()
  return { role: user.role }
}

export async function resendVerifyEmail(email) {
  const user = await User.findOne({ email, role: 'candidate', status: 'unverified' })
  if (user) await sendVerifyEmail(user)
}

export async function verifyRecruiterEmailCode(user, code) {
  if (user.emailVerifiedAt) throw new AppError('CONFLICT')
  await verifyCode(user._id, 'email', code)
  markEmailVerified(user)
  await user.save()
}

export async function resendRecruiterEmailCode(user) {
  if (user.emailVerifiedAt) throw new AppError('CONFLICT')
  await assertCodeResendAllowed(user._id, 'email')
  await sendEmailCode(user)
}

/** M-009: neutral reply; invited admins set their password through the invite instead. */
export async function forgotPassword(email) {
  const user = await User.findOne({ email })
  if (!user || user.status === 'invited') return
  const token = await issueEmailToken(user._id, 'reset_password', LIMITS.emailLink.resetTtlMs)
  await sendEmail({
    type: 'password_reset',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, link: `${config.clientOrigin}/reset-password?token=${token}` },
  })
}

/** M-009: signs out every session, marks the email verified, returns the role for the sign-in link. */
export async function resetPassword(raw, password) {
  const token = await findEmailToken(raw, 'reset_password')
  const user = await User.findById(token.userId)
  checkPassword(password, user.email)
  const passwordHash = await hashPassword(password)
  await useEmailToken(token)
  user.passwordHash = passwordHash
  user.tokenVersion += 1
  markEmailVerified(user)
  await user.save()
  return { role: user.role }
}
