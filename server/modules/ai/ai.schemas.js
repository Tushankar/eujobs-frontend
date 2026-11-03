import { z } from 'zod'
import { objectId } from '../../lib/validate.js'

/* AI requests (§5, §3.18). Translate names an entity, one of its texts and, for an entry, the entry id (M-144). */
export const jobParams = z.object({ id: objectId })
export const jobQuery = z.object({ jobId: objectId.optional() })
export const narrativeQuery = z.object({ section: z.enum(['overview', 'improve', 'skill_gap', 'job_match', 'why']), jobId: objectId.optional() })
export const feedbackParams = z.object({ jobId: objectId })
export const feedbackBody = z.object({ value: z.enum(['helpful', 'needs_review']).nullable() })
export const skillBody = z.object({ skill: z.string().max(100) })
export const skillParams = z.object({ skill: z.string().min(1).max(100) })

const FIELDS = { job: ['brief', 'responsibilities'], company: ['description'], candidate: ['about', 'workHistory'], message: ['body'], course: ['title', 'summary', 'about', 'lead', 'lesson'] }
export const translateBody = z
  .object({ entity: z.enum(Object.keys(FIELDS)), id: objectId, field: z.string(), entryId: objectId.optional() })
  .refine((body) => FIELDS[body.entity].includes(body.field), { path: ['field'], message: 'invalid' })
  .refine((body) => !['workHistory', 'lesson'].includes(body.field) || body.entryId, { path: ['entryId'], message: 'required' })
