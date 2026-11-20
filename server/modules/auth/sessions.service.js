import jwt from 'jsonwebtoken'
import { DateTime } from 'luxon'
import mongoose from 'mongoose'
import { config } from '../../config/env.js'
import { AppError } from '../../lib/errors.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { parseUserAgent } from '../../lib/userAgent.js'
import { User } from '../users/users.model.js'
import { LoginEvent, TrustedDevice } from './auth.model.js'
import { signToken } from './auth.service.js'

/* Devices and sign-in history (owner 2026-11-18): sessions, failed attempts, the new-device email and sign-outs. */
const SEEN_EVERY_MS = 60 * 1000
const HISTORY_LIMIT = 100
const SETTINGS_PATH = { candidate: '/candidate/settings/data-account', recruiter: '/recruiter/settings/data-account', admin: '/admin/settings', agency: '/agency/settings/data-account' }

// geoip-lite loads its city database into memory, so only on the first sign-in.
let geoip
async function locate(ip) {
  geoip ??= (await import('geoip-lite')).default
  const place = geoip.lookup(ip)
  return { city: place?.city || undefined, country: place?.country || undefined }
}

/** Who signed in from where: IP (IPv4 without its ::ffff: prefix), browser, OS, device type, city and country. */
export async function describe(req) {
  const ip = req.ip?.replace(/^::ffff:/, '')
  return { ip, ...parseUserAgent(req.get('user-agent')), ...(ip && (await locate(ip))) }
}

const sameDevice = ({ browser, os, deviceType }) => ({ browser, os, deviceType })

/**
 * A new session for `user`: records the sign-in (on the remembered browser `deviceId`, if any) and returns its token.
 * `alert` is when the "new sign-in" email goes out: 'always', 'newDevice' (a browser and system the account has not
 * used) or 'never' (the default; an emailed sign-in code already told the user).
 */
export async function startSession(user, req, { deviceId, alert = 'never' } = {}) {
  const _id = new mongoose.Types.ObjectId()
  const token = signToken(user, _id)
  const details = await describe(req)
  const [signedInBefore, deviceSeen] = await Promise.all([
    LoginEvent.exists({ userId: user._id, outcome: 'success' }),
    LoginEvent.exists({ userId: user._id, outcome: 'success', ...sameDevice(details) }),
  ])
  const now = new Date()
  await LoginEvent.create({ _id, userId: user._id, outcome: 'success', tv: user.tokenVersion, expiresAt: new Date(jwt.decode(token).exp * 1000), lastSeenAt: now, deviceId, ...details })
  if (alert === 'always' || (alert === 'newDevice' && signedInBefore && !deviceSeen)) await sendNewDeviceEmail(user, details, now)
  return token
}

/** A wrong password (or the wrong portal) for an existing account. */
export async function recordFailedSignIn(email, req) {
  const user = await User.findOne({ email }, '_id')
  if (user) await LoginEvent.create({ userId: user._id, outcome: 'failed', ...(await describe(req)) })
}

/** The session of a token, or null when it was signed out; marks it seen at most once a minute. */
export async function liveSession(sid, userId) {
  const session = await LoginEvent.findById(sid, 'userId revokedAt lastSeenAt')
  if (!session || session.revokedAt || !session.userId.equals(userId)) return null
  if (Date.now() - session.lastSeenAt > SEEN_EVERY_MS) await LoginEvent.updateOne({ _id: sid }, { lastSeenAt: new Date() })
  return session
}

function placeName({ city, country }, language) {
  const countryName = country && new Intl.DisplayNames([language], { type: 'region' }).of(country)
  return [city, countryName].filter(Boolean).join(', ')
}

/** The "sign-in details" rows of the security emails, in the user's language and time zone. */
export function signInFacts(user, details, at = new Date()) {
  const words = t(user.language, 'signIn')
  return {
    device: interpolate(words.device, { browser: details.browser ?? words.unknown, os: details.os ?? words.unknown }),
    location: placeName(details, user.language) || words.unknown,
    ip: details.ip ?? words.unknown,
    time: DateTime.fromJSDate(at, { zone: user.timezone || 'UTC' })
      .setLocale(user.language)
      .toLocaleString({ day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  }
}

async function sendNewDeviceEmail(user, details, at) {
  await sendEmail({
    type: 'new_device_sign_in',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, ...signInFacts(user, details, at), link: `${config.clientOrigin}${SETTINGS_PATH[user.role]}#devices` },
  })
}

/* ---------- the account's own list and sign-outs ---------- */

/** A session is active until it is signed out, its token expires, or the account's tokenVersion moves on. */
function statusOf(event, user, now) {
  if (event.outcome === 'failed') return 'failed'
  if (event.revokedAt || event.tv !== user.tokenVersion) return 'signed_out'
  return event.expiresAt > now ? 'active' : 'expired'
}

/** { devices: active sessions (most recent first), history: the last 100 sign-ins and failed attempts }. */
export async function listSessions(user, currentSid) {
  const now = new Date()
  const events = await LoginEvent.find({ userId: user._id }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean()
  const rows = events.map((event) => ({
    id: String(event._id),
    current: String(event._id) === currentSid,
    status: statusOf(event, user, now),
    browser: event.browser ?? null,
    browserVersion: event.browserVersion ?? null,
    os: event.os ?? null,
    deviceType: event.deviceType ?? 'desktop',
    ip: event.ip ?? null,
    city: event.city ?? null,
    country: event.country ?? null,
    signedInAt: event.createdAt,
    lastSeenAt: event.lastSeenAt ?? event.createdAt,
  }))
  const devices = rows.filter((row) => row.status === 'active').sort((a, b) => b.current - a.current || b.lastSeenAt - a.lastSeenAt)
  return { devices, history: rows }
}

/**
 * Signs one of the account's other sessions out (the current one signs out through POST /auth/logout); its browser is
 * no longer remembered, so signing in there asks for a code again.
 */
export async function revokeSession(user, id, currentSid) {
  if (id === currentSid) throw new AppError('VALIDATION_FAILED', { fields: { id: 'current_session' } })
  const session = await LoginEvent.findOneAndUpdate({ _id: id, userId: user._id, outcome: 'success', revokedAt: null }, { revokedAt: new Date() })
  if (!session) throw new AppError('NOT_FOUND')
  if (session.deviceId) await TrustedDevice.deleteOne({ _id: session.deviceId, userId: user._id })
}

/** Ends this device's session (sign out). */
export async function endSession(sid) {
  if (sid) await LoginEvent.updateOne({ _id: sid, revokedAt: null }, { revokedAt: new Date() })
}

/**
 * Signs every other device out, including tokens issued before sessions existed: the tokenVersion moves on, so this
 * device gets a new token for the same session. Only this device's browser stays remembered.
 */
export async function revokeOtherSessions(user, currentSid) {
  const now = new Date()
  const current = currentSid ? await LoginEvent.findById(currentSid, 'deviceId') : null
  await TrustedDevice.deleteMany({ userId: user._id, ...(current?.deviceId && { _id: { $ne: current.deviceId } }) })
  await LoginEvent.updateMany({ userId: user._id, outcome: 'success', revokedAt: null, _id: { $ne: currentSid } }, { revokedAt: now })
  user.tokenVersion += 1
  await user.save()
  if (currentSid) await LoginEvent.updateOne({ _id: currentSid }, { tv: user.tokenVersion })
  return signToken(user, currentSid)
}
