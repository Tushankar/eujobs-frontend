import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'

const language = z.enum(ENUMS.language)

export const legalParams = z.object({ doc: z.enum(ENUMS.legalDoc) })
export const legalQuery = z.object({ language: language.default('en') })
export const faqQuery = z.object({ language: language.optional() })
// `role` lets the public pricing page show the recruiter plans without a session; a signed-in user always gets their own.
export const plansQuery = z.object({ currency: z.string().trim().toUpperCase().length(3).optional(), language: language.optional(), role: z.enum(['candidate', 'recruiter']).optional() })
