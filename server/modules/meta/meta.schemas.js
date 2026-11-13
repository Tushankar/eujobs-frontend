import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'

const language = z.enum(ENUMS.language)

export const legalParams = z.object({ doc: z.enum(ENUMS.legalDoc) })
export const legalQuery = z.object({ language: language.default('en') })
export const faqQuery = z.object({ language: language.optional() })
// `role`: the public pricing page asks for either role's plans.
export const plansQuery = z.object({ currency: z.string().trim().toUpperCase().length(3).optional(), language: language.optional(), role: z.enum(['candidate', 'recruiter']).optional() })
