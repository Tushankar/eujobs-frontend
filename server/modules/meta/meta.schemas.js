import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'

const language = z.enum(ENUMS.language)

export const legalParams = z.object({ doc: z.enum(ENUMS.legalDoc) })
export const legalQuery = z.object({ language: language.default('en') })
export const faqQuery = z.object({ language: language.optional() })
export const plansQuery = z.object({ currency: z.string().trim().toUpperCase().length(3).optional(), language: language.optional() })
