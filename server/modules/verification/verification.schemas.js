import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'
import { codeBody } from '../auth/auth.schemas.js'

/** M-004: the number with a country-code input; a national number is read in `country`. */
export const phoneCodeBody = z.object({ phone: z.string().trim().min(1).max(32), country: z.string().trim().toUpperCase().length(2).optional() })
export const phoneConfirmBody = codeBody

/** Multipart fields arrive as strings (M-166); the service checks which fields each category needs. */
export const submissionBody = z.object({
  category: z.enum(ENUMS.verificationCategory),
  evidenceType: z.enum(ENUMS.evidenceType).optional(),
  entryId: objectId.optional(),
})

export const submissionParams = z.object({ id: objectId })
export const queueQuery = z.object({ status: z.enum(ENUMS.verificationStatus).default('in_review') })

/** M-166: Reject needs a reason of at most 300 characters. */
export const decisionBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(LIMITS.verificationReason.max).optional(),
})
