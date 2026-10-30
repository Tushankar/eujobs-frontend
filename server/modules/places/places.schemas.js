import { z } from 'zod'
import { LIMITS } from '../../config/limits.js'

const { input } = LIMITS.places

/** A Google place id as sent by city fields (§2.16). */
export const placeId = z.string().regex(/^[\w-]{10,300}$/)
// The client creates one per typing session (crypto.randomUUID()).
const sessionToken = z.uuid()

export const autocompleteQuery = z.object({ input: z.string().trim().min(input.min).max(input.max), sessionToken })
export const detailsParams = z.object({ placeId })
export const detailsQuery = z.object({ sessionToken: sessionToken.optional() })
