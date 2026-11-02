import { AppError } from '../lib/errors.js'
import { planState } from '../modules/payments/payments.service.js'

/**
 * U38, M-118: a candidate without the entitlement gets 402 PLAN_REQUIRED { entitlement }. Only candidates have a
 * plan (M-117), so other roles pass; their own role checks decide. Use after requireAuth.
 */
export function requireEntitlement(key) {
  return async (req, res, next) => {
    if (req.user.role === 'candidate' && !(await planState(req.user._id)).entitlements.includes(key)) {
      throw new AppError('PLAN_REQUIRED', { params: { entitlement: key } })
    }
    next()
  }
}
