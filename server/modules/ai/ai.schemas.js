import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { PLACES_SKUS } from '../../lib/usage.js'
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

/* Admin › AI & matching › Usage (2026-11-17): limits, monthly budgets in USD (null: none) and prices in USD. */
const U = LIMITS.ai.usage
const cap = z.number().int().min(U.capRange.min).max(U.capRange.max)
const caps = z.object({ month: cap, year: cap })
const price = z.number().min(0).max(U.priceMax)
const budget = z.number().positive().max(U.budgetMax).nullable()
export const usageQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() })
export const usageSettingsBody = z.object({
  caps: z.object({ plus: caps, recruiter_plus: caps }),
  featureLimits: z.object({ cv_draft: cap, cv_snapshot: cap }),
  burstPerMinute: z.number().int().min(U.burstRange.min).max(U.burstRange.max),
  skillNamesPerDay: cap,
  budgets: z.object({ openai: budget, places: budget }),
  prices: z.object({
    openai: z
      .array(z.object({ model: z.string().trim().min(1).max(100), input: price.nullable(), output: price.nullable(), minute: price.nullable() }))
      .max(50)
      .refine((items) => new Set(items.map((item) => item.model)).size === items.length, 'duplicate'),
    places: z
      .array(z.object({ sku: z.enum(PLACES_SKUS), perThousand: price }))
      .refine((items) => new Set(items.map((item) => item.sku)).size === items.length, 'duplicate'),
  }),
})

/* 2026-11-17 (phase 2): recruiter drafts. `notes` is what the recruiter types for the AI. */
const notes = z.string().trim().max(LIMITS.ai.notes.max).default('')
export const jobDraftBody = z.object({
  title: z.string().trim().min(LIMITS.job.title.min).max(LIMITS.job.title.max),
  employmentType: z.enum(ENUMS.employmentType),
  notes,
})
export const companyDescriptionBody = z.object({
  name: z.string().trim().min(LIMITS.company.name.min).max(LIMITS.company.name.max),
  industry: z.string().trim().max(LIMITS.company.industry.max).default(''),
  size: z.enum(ENUMS.companySize).nullable().default(null),
  city: z.string().trim().max(100).default(''),
  notes,
})
export const messageDraftBody = z.discriminatedUnion('purpose', [
  z.object({ purpose: z.literal('first_message'), candidateId: objectId, jobId: objectId.optional(), notes }),
  z.object({ purpose: z.literal('status_update'), applicationId: objectId, rejected: z.boolean().default(false), notes }),
  z.object({ purpose: z.literal('reply'), conversationId: objectId, notes }),
])
