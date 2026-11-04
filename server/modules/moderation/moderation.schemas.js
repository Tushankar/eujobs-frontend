import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

// U20: reason from the list, details ≤ 500.
export const reportBody = z.object({
  targetType: z.enum(ENUMS.reportTargetType),
  targetId: objectId,
  reason: z.enum(ENUMS.reportReason),
  details: z.string().trim().max(LIMITS.report.details.max).default(''),
})

// "Open case" from admin Jobs: the admin names the reason like a reporter would.
export const caseBody = z.object({
  reason: z.enum(ENUMS.reportReason),
  details: z.string().trim().max(LIMITS.report.details.max).default(''),
})

// M-167: a reason is required to restrict; removing the photo applies to profiles (M-013).
export const decisionBody = z.object({
  action: z.enum(['dismiss', 'restrict']),
  reason: z.string().trim().max(LIMITS.moderationReason.max).default(''),
  removePhoto: z.boolean().default(false),
})

export const idParams = z.object({ id: objectId })
