import { z } from 'zod'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

/* Admin AI & matching (M-048, M-049, A: admin §1.18, §1.19). */
const M = LIMITS.matching

export const idParams = z.object({ id: objectId })

const name = z.string().trim().min(M.policyName.min).max(M.policyName.max)
const description = z.string().trim().min(M.policyDescription.min).max(M.policyDescription.max)

export const createBody = z.object({ name, description })
export const updateBody = z.object({ name, description })
export const signalsBody = z.object({ skills: z.boolean(), experience: z.boolean(), location: z.boolean() })
export const suggestBody = z.object({ name, description: z.string().trim().min(1).max(M.policyDescription.max) })
export const oversightQuery = z.object({ jobId: objectId.optional(), candidateId: objectId.optional() })
