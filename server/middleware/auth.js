import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { isHiring } from '../config/enums.js'
import { AppError } from '../lib/errors.js'
import { Company } from '../modules/companies/companies.model.js'
import { currentStep } from '../modules/companies/companies.service.js'
import { findSession, liveSession } from '../modules/auth/sessions.service.js'
import { User } from '../modules/users/users.model.js'

/**
 * The user of a valid Bearer JWT whose tokenVersion matches (M-007, M-011) and whose session (`sid`, 2026-11-18) is
 * not signed out, else null. Sets req.sessionId.
 */
async function sessionUser(req) {
  const header = req.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null
  let claims
  try {
    claims = jwt.verify(header.slice(7), config.jwt.secret, { algorithms: ['HS256'] })
  } catch {
    return null
  }
  // Both ids are in the token, so the user and the session are read together (perf 2026-11-24).
  const [user, session] = await Promise.all([User.findById(claims.sub), claims.sid ? findSession(claims.sid) : null])
  if (!user || user.tokenVersion !== claims.tv) return null
  if (claims.sid && !liveSession(session, user._id)) return null
  req.sessionId = claims.sid
  return user
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

/** U37: a recruiter or agency before the email code may only use code verify, code resend and /me. */
export function requireVerifiedEmail(req, res, next) {
  if (isHiring(req.user.role) && !req.user.emailVerifiedAt) throw new AppError('EMAIL_UNVERIFIED')
  next()
}

/**
 * M-151, M-165: recruiter workspace endpoints are for approved (active) recruiters and agencies (2026-11-20); sets
 * req.company. Use after requireAuth.
 */
export async function requireApprovedRecruiter(req, res, next) {
  await assertApprovedRecruiter(req.user)
  req.company = await Company.findById(req.user.companyId)
  next()
}

/** requireApprovedRecruiter's checks without loading the company (GET /me/counters reads none, perf 2026-11-24). */
export async function assertApprovedRecruiter(user) {
  if (!isHiring(user.role)) throw new AppError('FORBIDDEN')
  if (!user.emailVerifiedAt) throw new AppError('EMAIL_UNVERIFIED')
  if (user.status === 'suspended') throw new AppError('ACCOUNT_SUSPENDED')
  if (user.status !== 'active') throw new AppError('RECRUITER_NOT_APPROVED', { params: { status: user.status, step: await currentStep(user) } })
}

/** 2026-11-20: agency-only endpoints (clients); an approved agency, with req.company. Use after requireAuth. */
export async function requireApprovedAgency(req, res, next) {
  if (req.user.role !== 'agency') throw new AppError('FORBIDDEN')
  return requireApprovedRecruiter(req, res, next)
}
