import { createHash, randomBytes } from 'node:crypto'
import { LIMITS } from '../../config/limits.js'
import { AppError } from '../../lib/errors.js'
import { sendEmail } from '../../lib/mailer.js'
import { meDto } from '../users/users.service.js'
import { User } from '../users/users.model.js'
import { LoginChallenge, TrustedDevice, VerificationCode } from './auth.model.js'
import { assertCodeResendAllowed, issueCode, verifyCode } from './auth.service.js'
import { startSession } from './sessions.service.js'
import { checkSecondFactor, enableWith, newSetup, twoFactorOn } from './twoFactor.service.js'

/*
 * The sign-in second step (owner 2026-11-18). After a correct password:
 * - admins always enter their authenticator code (or set the app up first);
 * - everyone else on a remembered browser is signed in; on any other browser they enter the authenticator code when
 *   2FA is on, else a 6-digit code emailed to them. Passing the step remembers the browser for 90 days.
 */
const CHALLENGE_TTL_MS = 10 * 60 * 1000
const TRUST_TTL_MS = 90 * 24 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5
// Wrong authenticator codes per account in 15 minutes, across challenges.
const MAX_FAILED_PER_WINDOW = 10
const FAILED_WINDOW_MS = 15 * 60 * 1000

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

/** "t•••@housbe.com": enough to recognise the address. */
const maskEmail = (email) => email.replace(/^(.)[^@]*(@.*)$/, (match, first, domain) => `${first}•••${domain}`)

async function trustedDevice(user, deviceToken) {
  if (typeof deviceToken !== 'string' || !deviceToken) return null
  return TrustedDevice.findOne({ userId: user._id, tokenHash: sha256(deviceToken), expiresAt: { $gt: new Date() } })
}

/** Remembers this browser for 90 days: answers the key it keeps, and the record's id for its sessions. */
export async function trustBrowser(user) {
  const raw = randomBytes(32).toString('base64url')
  const device = await TrustedDevice.create({ userId: user._id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + TRUST_TTL_MS) })
  return { deviceToken: raw, deviceId: device._id }
}

async function sendLoginCode(user) {
  const code = await issueCode(user._id, 'login', user.email)
  await sendEmail({ type: 'login_code', to: user.email, userId: user._id, language: user.language, params: { name: user.fullName, code } })
}

/** What the sign-in page needs to show the step; `rememberDays` when passing it remembers the browser (not admins). */
const verificationDto = (user, method, raw) => ({
  challenge: raw,
  method,
  ...(method === 'email' && { email: maskEmail(user.email) }),
  ...(user.role !== 'admin' && { rememberDays: TRUST_TTL_MS / 86_400_000 }),
})

/** After a correct password: { token, me } when no step is due, else { verification }. */
export async function beginLogin(user, req, deviceToken) {
  const admin = user.role === 'admin'
  if (!admin) {
    const device = await trustedDevice(user, deviceToken)
    if (device) return { token: await startSession(user, req, { deviceId: device._id }), me: await meDto(user) }
  }
  const method = twoFactorOn(user) ? 'totp' : admin ? 'totp_setup' : 'email'
  if (method === 'email') {
    // An unused code sent in the last minute still works; otherwise a new one goes out (five an hour at most).
    const now = Date.now()
    const recent = { userId: user._id, channel: 'login', sentAt: { $gte: new Date(now - LIMITS.code.resendAfterMs) } }
    const live = await VerificationCode.exists({ ...recent, consumedAt: null, expiresAt: { $gt: new Date(now) } })
    const sentThisHour = await VerificationCode.countDocuments({ userId: user._id, channel: 'login', sentAt: { $gte: new Date(now - 3_600_000) } })
    if (!live && sentThisHour < LIMITS.code.maxPerHour) await sendLoginCode(user)
  }
  const raw = randomBytes(32).toString('base64url')
  await LoginChallenge.create({ userId: user._id, method, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) })
  return { verification: verificationDto(user, method, raw) }
}

async function openChallenge(raw) {
  const challenge = typeof raw === 'string' ? await LoginChallenge.findOne({ tokenHash: sha256(raw) }) : null
  if (!challenge) throw new AppError('TOKEN_INVALID')
  if (challenge.consumedAt) throw new AppError('TOKEN_USED')
  if (challenge.expiresAt < new Date() || challenge.attempts >= MAX_ATTEMPTS) throw new AppError('TOKEN_EXPIRED')
  const user = await User.findById(challenge.userId)
  if (!user) throw new AppError('TOKEN_INVALID')
  return { challenge, user }
}

async function failedAppCodes(userId) {
  const recent = await LoginChallenge.find({ userId, method: { $ne: 'email' }, createdAt: { $gte: new Date(Date.now() - FAILED_WINDOW_MS) } }, 'attempts')
  return recent.reduce((sum, item) => sum + item.attempts, 0)
}

/** A wrong authenticator code: CODE_INVALID with the attempts left, or CODE_LOCKED (sign in again). */
async function wrongAppCode(challenge) {
  challenge.attempts += 1
  await challenge.save()
  const attemptsLeft = MAX_ATTEMPTS - challenge.attempts
  throw new AppError(attemptsLeft > 0 ? 'CODE_INVALID' : 'CODE_LOCKED', { params: { attemptsLeft: Math.max(attemptsLeft, 0) } })
}

/** POST /auth/login/setup: the authenticator secret and QR code for an admin setting 2FA up during sign-in. */
export async function loginSetup(raw) {
  const { challenge, user } = await openChallenge(raw)
  if (challenge.method !== 'totp_setup') throw new AppError('CONFLICT')
  const { stored, setup } = await newSetup(user)
  challenge.pendingSecret = stored
  await challenge.save()
  return setup
}

/** POST /auth/login/resend: a new emailed code (once a minute, five an hour). */
export async function resendLoginCode(raw) {
  const { challenge, user } = await openChallenge(raw)
  if (challenge.method !== 'email') throw new AppError('CONFLICT')
  await assertCodeResendAllowed(user._id, 'login')
  await sendLoginCode(user)
}

/**
 * POST /auth/login/verify: the code finishes the sign-in. Answers { token, me }, plus `deviceToken` when the browser
 * is now remembered and `backupCodes` when an admin just set 2FA up.
 */
export async function verifyLogin(raw, code, req) {
  const { challenge, user } = await openChallenge(raw)
  let backupCodes
  if (challenge.method === 'email') {
    await verifyCode(user._id, 'login', String(code ?? '').trim())
  } else {
    if ((await failedAppCodes(user._id)) >= MAX_FAILED_PER_WINDOW) throw new AppError('RATE_LIMITED', { params: { retryAfter: FAILED_WINDOW_MS / 1000 } })
    const entered = String(code ?? '').trim()
    if (challenge.method === 'totp_setup') {
      if (!challenge.pendingSecret) throw new AppError('CONFLICT')
      backupCodes = await enableWith(user, challenge.pendingSecret, entered)
      if (!backupCodes) await wrongAppCode(challenge)
    } else if (!(await checkSecondFactor(user, entered))) {
      await wrongAppCode(challenge)
    }
  }
  const { modifiedCount } = await LoginChallenge.updateOne({ _id: challenge._id, consumedAt: null }, { consumedAt: new Date() })
  if (!modifiedCount) throw new AppError('TOKEN_USED')

  user.lastLoginAt = new Date()
  await user.save()
  // Admins enter their code every time, so their browser is not remembered.
  const trusted = user.role === 'admin' ? null : await trustBrowser(user)
  const token = await startSession(user, req, { deviceId: trusted?.deviceId, alertIfNew: challenge.method !== 'email' })
  return { token, me: await meDto(user), ...(trusted && { deviceToken: trusted.deviceToken }), ...(backupCodes && { backupCodes }) }
}
