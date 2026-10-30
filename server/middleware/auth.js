import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { AppError } from '../lib/errors.js'
import { User } from '../modules/users/users.model.js'

/** The user of a valid Bearer JWT whose tokenVersion matches (M-007, M-011), else null. */
async function sessionUser(req) {
  const header = req.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null
  let claims
  try {
    claims = jwt.verify(header.slice(7), config.jwt.secret, { algorithms: ['HS256'] })
  } catch {
    return null
  }
  const user = await User.findById(claims.sub)
  return user && user.tokenVersion === claims.tv ? user : null
}

/** The user is loaded on every request. */
export async function requireAuth(req, res, next) {
  const user = await sessionUser(req)
  if (!user) throw new AppError('AUTH_REQUIRED')
  req.user = user
  next()
}

/** Public routes that use the session when there is one (GET /plans); a bad token counts as anonymous. */
export async function optionalAuth(req, res, next) {
  req.user = (await sessionUser(req)) ?? undefined
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new AppError('FORBIDDEN')
    next()
  }
}

/** U37: a recruiter before the email code may only use code verify, code resend and /me. */
export function requireVerifiedEmail(req, res, next) {
  if (req.user.role === 'recruiter' && !req.user.emailVerifiedAt) throw new AppError('EMAIL_UNVERIFIED')
  next()
}
