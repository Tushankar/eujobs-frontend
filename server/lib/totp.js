import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '../config/env.js'

/*
 * Authenticator-app codes (RFC 6238 TOTP: HMAC-SHA1, 6 digits, 30 s steps), owner 2026-11-18. Secrets are stored
 * encrypted (AES-256-GCM, key derived from JWT_SECRET), so rotating JWT_SECRET means setting 2FA up again.
 */
const STEP_SECONDS = 30
const DIGITS = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32(buffer) {
  let bits = ''
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')
  return bits.match(/.{1,5}/g).map((chunk) => ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)]).join('')
}

function fromBase32(text) {
  const bits = [...text.replace(/=+$/, '').toUpperCase()].map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, '0')).join('')
  return Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)))
}

/** A new 160-bit secret in Base32 (what authenticator apps take). */
export const newSecret = () => base32(randomBytes(20))

/** The code an authenticator app shows for `secret` at time step `step`. */
export function codeAt(secret, step = currentStep()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', fromBase32(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS).padStart(DIGITS, '0')
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS)

/**
 * The time step `code` belongs to (the current one or one either side, for clock drift), or null. A step at or before
 * `lastStep` is refused, so a code works once.
 */
export function matchStep(secret, code, lastStep = -1) {
  if (!/^\d{6}$/.test(code ?? '')) return null
  const now = currentStep()
  for (const step of [now, now - 1, now + 1]) {
    if (step > lastStep && timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(code))) return step
  }
  return null
}

/** The otpauth:// link a QR code carries. */
export const otpauthUrl = (secret, account, issuer) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`

const KEY = createHash('sha256').update(`${config.jwt.secret}:totp`).digest()

export function encryptSecret(secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(stored) {
  const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
