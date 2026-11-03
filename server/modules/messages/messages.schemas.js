import { z } from 'zod'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

/* Conversations and messages (§3.5, §5). Who may start or reply is checked in the service. */
export const idParams = z.object({ id: objectId })

// M-086: text only, up to 2,000 characters.
const body = z.string().trim().min(1).max(LIMITS.message.body.max)

// A recruiter names the candidate (and optionally one of the company's jobs); a candidate names the job they applied to.
export const startBody = z.object({ candidateId: objectId.optional(), jobId: objectId.optional(), body })

export const messageBody = z.object({ body })
