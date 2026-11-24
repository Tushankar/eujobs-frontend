import ISO6391 from 'iso-639-1'
import { z } from 'zod'
import { ENUMS, JOB_TYPES } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { pageQuery } from '../../lib/pages.js'
import { objectId } from '../../lib/validate.js'
import { placeId } from '../places/places.schemas.js'

/*
 * Job fields (M-033, M-035, U26, P4-D6 … D8). This schema checks formats only, so a draft can be saved with
 * later steps empty (M-041); the service adds the publish requirements and the cross-field rules.
 */
const J = LIMITS.job
const skills = (max) => z.array(z.string().trim().min(1).max(J.requiredSkills.itemMax)).max(max)
const salaryAmount = z.number().int().min(J.salary.min).max(J.salary.max).nullable().default(null)
const A = J.agency
const day = z.iso.date().nullable().default(null)
export const sectorKey = z.string().regex(/^[a-z0-9_]{1,50}$/)

/* 2026-11-20: an agency job's terms; formats only, so a draft can be saved with them empty (publish rules in the service). */
export const agencyTermsBody = z.object({
  clientId: objectId.nullable().default(null),
  showClient: z.boolean().default(true),
  startDate: day,
  endDate: day,
  // `currency` is the agency's choice for remote jobs only, as for salary.
  rate: z
    .object({ amountMinor: z.number().int().min(A.rate.min).max(A.rate.max).nullable().default(null), period: z.enum(ENUMS.ratePeriod), currency: z.string().trim().toUpperCase().length(3).optional() })
    .nullable()
    .default(null),
  hoursPerWeek: z.number().int().min(A.hoursPerWeek.min).max(A.hoursPerWeek.max).nullable().default(null),
})

export const jobBody = z.object({
  title: z.string().trim().min(J.title.min).max(J.title.max),
  employmentType: z.enum(ENUMS.employmentType),
  // 2026-11-24: a sector key (GET /meta/sectors); needed to publish.
  sector: sectorKey.nullable().default(null),
  brief: z.string().trim().max(J.brief.max).default(''),
  responsibilities: z.array(z.string().trim().min(1).max(J.responsibilities.itemMax)).max(J.responsibilities.max).default([]),
  requiredSkills: skills(J.requiredSkills.max).default([]),
  preferredSkills: skills(J.preferredSkills.max).default([]),
  level: z.enum(ENUMS.jobLevel).nullable().default(null),
  experienceYears: z.number().int().min(J.experienceYears.min).max(J.experienceYears.max).nullable().default(null),
  requiredLanguages: z
    .array(z.object({ code: z.enum(ISO6391.getAllCodes()), minLevel: z.enum(ENUMS.languageLevel) }))
    .max(J.languages.max)
    .default([]),
  visaSponsorship: z.boolean().default(false),
  workPreference: z.enum(ENUMS.workPreference).nullable().default(null),
  // On-site and hybrid jobs: the city (G-1). Remote jobs: the eligible countries (OQ-6i).
  placeId: placeId.nullable().default(null),
  remoteCountries: z.array(z.string().trim().toUpperCase().length(2)).max(J.remoteCountries.max).default([]),
  // P4-D8: optional; the currency follows the job country (M-131).
  // `currency` is the recruiter's choice for remote jobs only (2026-11-16); other jobs pay in their country's currency.
  salary: z
    .object({ min: salaryAmount, max: salaryAmount, period: z.enum(ENUMS.salaryPeriod), currency: z.string().trim().toUpperCase().length(3).optional() })
    .nullable()
    .default(null),
  // Agencies only (2026-11-20); company jobs leave it out.
  agency: agencyTermsBody.nullable().default(null),
})

export const jobParams = z.object({ id: objectId })
export const statusBody = z.object({ status: z.enum(ENUMS.jobStatus) })
// Admin › Jobs (M-046, P10-Q4, P10-Q15): status, country (REMOTE included), search, server pages.
export const adminJobsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ENUMS.jobStatus).optional(),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2}|REMOTE)$/).optional(),
  ...pageQuery,
})

export const suggestionsQuery = z.object({ q: z.string().trim().max(J.requiredSkills.itemMax).default('') })

/* Candidate browsing (M-137, OD2, U25, P4-Q4). Lists of values arrive as comma-separated text. */
const list = (values) =>
  z
    .string()
    .default('')
    .transform((text) => text.split(',').filter(Boolean))
    .pipe(z.array(z.enum(values)))

export const searchQuery = z.object({
  q: z.string().trim().max(200).default(''),
  workPreference: list(ENUMS.workPreference),
  level: list(ENUMS.jobLevel),
  // 2026-11-20: job types; "agency" is every agency job (which keeps its full or part time too).
  employmentType: list(JOB_TYPES),
  placeId: placeId.optional(),
  salaryMin: z.coerce.number().int().min(0).max(J.salary.max).optional(),
  eligible: z.string().trim().toUpperCase().length(2).optional(),
  // Only jobs that sponsor a work visa (2026-11-16).
  visaSponsorship: z.enum(['1']).optional(),
  sort: z.enum(['recommended', 'newest', 'salary']).default('recommended'),
})
