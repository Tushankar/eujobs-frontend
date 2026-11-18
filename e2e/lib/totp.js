import { createHmac } from 'node:crypto'

/*
 * Authenticator codes for the e2e admins (2026-11-18), the same RFC 6238 maths as server/lib/totp.js (which cannot be
 * imported here: it reads the server's env). The server takes each time step once and accepts one step either side,
 * so up to three sign-ins per 30 s go through without waiting.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const secrets = new Map()
const lastSteps = new Map()

const step = () => Math.floor(Date.now() / 30_000)

function codeAt(secret, at) {
  const bits = [...secret].map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, '0')).join('')
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(at))
  const hmac = createHmac('sha1', key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** Keeps the account's secret after a setup (spaces, as shown on screen, are dropped). */
export function rememberSecret(email, secret) {
  secrets.set(email.toLowerCase(), secret.replace(/\s+/g, ''))
  lastSteps.delete(email.toLowerCase())
}

export const hasSecret = (email) => secrets.has(email.toLowerCase())

/** The next code the server will take for `email`, waiting for a new time step when the window is used up. */
export async function nextAppCode(email) {
  const key = email.toLowerCase()
  const secret = secrets.get(key)
  if (!secret) throw new Error(`no authenticator secret for ${email}`)
  for (;;) {
    const now = step()
    const next = Math.max(now - 1, (lastSteps.get(key) ?? -Infinity) + 1)
    if (next <= now + 1) {
      lastSteps.set(key, next)
      return codeAt(secret, next)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
