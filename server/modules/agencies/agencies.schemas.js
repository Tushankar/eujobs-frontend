import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'
import { placeId } from '../places/places.schemas.js'

/* 2026-11-20: an agency's clients. Only the name is required; the rest can be added later. */
const C = LIMITS.company
const text = ({ min, max }) => z.string().trim().min(min).max(max)

export const clientBody = z.object({
  name: text(C.name),
  industry: text(C.industry).nullable().default(null),
  placeId: placeId.nullable().default(null),
  // An EU Jobs company this client is, so same-client rules match it exactly.
  linkedCompanyId: objectId.nullable().default(null),
})

export const clientParams = z.object({ id: objectId })
export const companySearchQuery = z.object({ q: z.string().trim().min(2).max(C.name.max) })

/* 2026-11-20: the books */
export const talentQuery = z.object({ status: z.enum(ENUMS.membershipStatus).optional() })
export const inviteBody = z.object({ candidateId: objectId })
export const companyParams = z.object({ companyId: objectId })
export const agreeBody = z.object({ version: z.number().int().min(1) })

/* 2026-11-20: placements */
export const placementsQuery = z.object({ view: z.enum(['offered', 'upcoming', 'running', 'over']).optional() })
export const endBody = z.object({ endDate: z.iso.date() })
export const rehireBody = z.object({ jobId: objectId })
export const checkQuery = z.object({ jobId: objectId })
