import { AppError } from '../lib/errors.js'
import { planState } from '../modules/payments/payments.service.js'

/** The 402 a missing entitlement answers (U38, M-118, §3.22). */
export const planRequired = (entitlement) => new AppError('PLAN_REQUIRED', { params: { entitlement } })

export async function hasEntitlement(user, key) {
  return (await planState(user._id)).entitlements.includes(key)
}

/**
 * U38, M-118, §3.22: a user of one of `roles` without the entitlement gets 402 PLAN_REQUIRED { entitlement }. Other
 * roles pass; their own role checks decide. Candidates by default; recruiter locks name `recruiter`. Use after requireAuth.
 */
export function requireEntitlement(key, roles = ['candidate']) {
  return async (req, res, next) => {
    if (roles.includes(req.user.role) && !(await hasEntitlement(req.user, key))) throw planRequired(key)
    next()
  }
}
