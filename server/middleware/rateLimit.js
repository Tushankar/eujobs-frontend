import { ipKeyGenerator, MemoryStore, rateLimit } from 'express-rate-limit'
import { LIMITS } from '../config/limits.js'
import { AppError } from '../lib/errors.js'

/*
 * In-memory rate limits (M-008, U1), answered with RATE_LIMITED + retryAfter seconds.
 * Behind a local cloudflared tunnel the client address is CF-Connecting-IP (C26).
 */
const stores = []

const isLoopback = (address = '') => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)

const byIp = (req) => ipKeyGenerator(isLoopback(req.socket.remoteAddress) && req.get('cf-connecting-ip') ? req.get('cf-connecting-ip') : req.ip)
const byEmail = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '')
const byUser = (req) => String(req.user._id)

function limiter({ windowMs, limit }, keyGenerator, options = {}) {
  const store = new MemoryStore()
  stores.push(store)
  return rateLimit({
    windowMs,
    limit,
    store,
    keyGenerator,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...options,
    handler: (req, res, next) => {
      const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
      next(new AppError('RATE_LIMITED', { params: { retryAfter } }))
    },
  })
}

const { rateLimits } = LIMITS
export const loginsPerIp = limiter(rateLimits.loginsPerIp, byIp)
export const failedLoginsPerEmail = limiter(rateLimits.failedLoginsPerEmail, byEmail, { skipSuccessfulRequests: true })
export const forgotPasswordPerEmail = limiter(rateLimits.forgotPasswordPerEmail, byEmail)
export const signUpsPerIp = limiter(rateLimits.signUpsPerIp, byIp)
// After requireAuth (§2.16)
export const placesAutocompletePerUser = limiter(LIMITS.places.perUser.autocomplete, byUser)
export const placesDetailsPerUser = limiter(LIMITS.places.perUser.details, byUser)

/** Clears every store (the /_test/reset route). */
export function resetRateLimits() {
  return Promise.all(stores.map((store) => store.resetAll()))
}
