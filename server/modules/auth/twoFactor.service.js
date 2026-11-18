import { createHash, randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { AppError, fieldError } from '../../lib/errors.js'
import { decryptSecret, encryptSecret, matchStep, newSecret, otpauthUrl } from '../../lib/totp.js'
import { User } from '../users/users.model.js'
import { TrustedDevice } from './auth.model.js'

/* Authenticator-app 2FA (owner 2026-11-18): required for admins (set up at sign-in), optional for everyone else. */
const ISSUER = 'EU Jobs'
const BACKUP_CODES = 10
const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const normalizeBackup = (code) => String(code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const twoFactorOn = (user) => Boolean(user.twoFactor?.enabledAt)

/** What the account's Settings show: on or off, and how many backup codes are left. */
export function twoFactorDto(user) {
  return { enabled: twoFactorOn(user), backupCodesLeft: user.twoFactor?.backupCodes?.filter((code) => !code.usedAt).length ?? 0 }
}

/** A new secret with what the authenticator app needs: the Base32 key, its otpauth link and a QR code image. */
export async function newSetup(user) {
  const secret = newSecret()
  const url = otpauthUrl(secret, user.email, ISSUER)
  return { secret, stored: encryptSecret(secret), setup: { secret, otpauthUrl: url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) } }
}

/** Ten one-time codes ("abcd-efgh"); only their hashes are kept. */
function newBackupCodes() {
  const codes = Array.from({ length: BACKUP_CODES }, () => {
    const raw = Array.from({ length: 8 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join('')
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
  return { codes, stored: codes.map((code) => ({ hash: sha256(normalizeBackup(code)) })) }
}

/** Turns 2FA on with `storedSecret` once `code` matches it; returns the backup codes (shown once). */
export async function enableWith(user, storedSecret, code) {
  const step = matchStep(decryptSecret(storedSecret), code)
  if (step === null) return null
  const backup = newBackupCodes()
  user.twoFactor = { secret: storedSecret, enabledAt: new Date(), lastStep: step, backupCodes: backup.stored }
  await user.save()
  return backup.codes
}

/**
 * True when `code` is the app's current code (once per time step) or an unused backup code (used up). Both writes
 * are conditional, so two requests cannot spend the same code.
 */
export async function checkSecondFactor(user, code) {
  const step = matchStep(decryptSecret(user.twoFactor.secret), code, user.twoFactor.lastStep ?? -1)
  if (step !== null) {
    const { modifiedCount } = await User.updateOne(
      { _id: user._id, $or: [{ 'twoFactor.lastStep': { $lt: step } }, { 'twoFactor.lastStep': null }] },
      { 'twoFactor.lastStep': step },
    )
    return modifiedCount === 1
  }
  const hash = sha256(normalizeBackup(code))
  const { modifiedCount } = await User.updateOne(
    { _id: user._id, 'twoFactor.backupCodes': { $elemMatch: { hash, usedAt: null } } },
    { $set: { 'twoFactor.backupCodes.$[code].usedAt': new Date() } },
    { arrayFilters: [{ 'code.hash': hash, 'code.usedAt': null }] },
  )
  return modifiedCount === 1
}

/* ---------- Settings (signed in) ---------- */

async function assertPassword(user, password) {
  if (!(await bcrypt.compare(password ?? '', user.passwordHash))) throw fieldError({ password: 'invalid' })
}

/** POST /me/2fa/setup: a secret waiting for its first code. */
export async function startSetup(user) {
  if (twoFactorOn(user)) throw new AppError('CONFLICT')
  const { stored, setup } = await newSetup(user)
  user.twoFactor = { pendingSecret: stored }
  await user.save()
  return setup
}

/** POST /me/2fa/enable: the first code turns 2FA on and answers the backup codes. */
export async function enable(user, code) {
  if (twoFactorOn(user) || !user.twoFactor?.pendingSecret) throw new AppError('CONFLICT')
  const codes = await enableWith(user, user.twoFactor.pendingSecret, code)
  if (!codes) throw fieldError({ code: 'invalid' })
  return { backupCodes: codes }
}

/** POST /me/2fa/disable: candidates and recruiters only; admins must keep it. */
export async function disable(user, password) {
  if (user.role === 'admin') throw new AppError('FORBIDDEN')
  await assertPassword(user, password)
  user.twoFactor = undefined
  await user.save()
}

/** POST /me/2fa/backup-codes: new codes replace the old ones. */
export async function regenerateBackupCodes(user, password) {
  if (!twoFactorOn(user)) throw new AppError('CONFLICT')
  await assertPassword(user, password)
  const backup = newBackupCodes()
  user.twoFactor.backupCodes = backup.stored
  await user.save()
  return { backupCodes: backup.codes }
}

/**
 * The Owner resets another admin's 2FA (lost phone and backup codes): it is off, every session and remembered
 * browser of that admin ends, and they set it up again at their next sign-in.
 */
export async function resetForAdmin(owner, target) {
  if (!owner.isOwner) throw new AppError('FORBIDDEN')
  if (target.role !== 'admin' || target._id.equals(owner._id)) throw new AppError('FORBIDDEN')
  target.twoFactor = undefined
  target.tokenVersion += 1
  await target.save()
  await TrustedDevice.deleteMany({ userId: target._id })
}
