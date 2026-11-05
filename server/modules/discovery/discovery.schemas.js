import ISO6391 from 'iso-639-1'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'
import { placeId } from '../places/places.schemas.js'

/* Find candidates and the candidate profile (M-054 … M-056, OD4, OQ-6f, P4-D10), notes (M-080), CV requests (M-029). */
const flag = z.enum(['1']).optional()

export const discoveryQuery = z.object({
  q: z.string().trim().max(200).default(''),
  jobId: objectId.optional(),
  workPreference: z.enum(ENUMS.workPreference).optional(),
  availability: z.enum(ENUMS.availability).optional(),
  minYears: z.coerce.number().int().min(0).max(LIMITS.profile.yearsExperience.max).optional(),
  skill: z.string().trim().max(LIMITS.profile.skills.itemMax).optional(),
  rightToWork: flag,
  language: z.enum(ISO6391.getAllCodes()).optional(),
  languageLevel: z.enum(ENUMS.languageLevel).optional(),
  verified: flag,
  placeId: placeId.optional(),
  sort: z.enum(['recommended', 'experience', 'name']).default('recommended'),
})

export const candidateParams = z.object({ id: objectId })
const noteText = z.string().trim().min(1).max(LIMITS.note.max)
export const noteBody = z.object({ text: noteText, applicationId: objectId.optional() })
export const notePatchBody = z.object({ text: noteText })
export const noteParams = z.object({ id: objectId, noteId: objectId })
export const cvRequestBody = z.object({
  reason: z.enum(ENUMS.cvRequestReason),
  details: z.string().trim().max(LIMITS.cvRequestDetails.max).default(''),
})
