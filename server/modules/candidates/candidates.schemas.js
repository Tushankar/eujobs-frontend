import ISO6391 from 'iso-639-1'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'
import { fullName } from '../auth/auth.schemas.js'
import { placeId } from '../places/places.schemas.js'

/* §3.2 field rules. Rules that compare fields (dates, duplicates, currency) live in the service. */
const P = LIMITS.profile
const text = (max) => z.string().trim().min(1).max(max)
const optionalText = (max) => z.string().trim().max(max).optional()
const entryText = text(P.entryText.max)
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const https = z.url({ protocol: /^https$/ }).max(P.url.max)
// M-022: linkedin.com/in/… (country subdomains such as uk.linkedin.com included)
const linkedin = z.string().trim().max(P.url.max).regex(/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#\s]+\/?$/i)
// '' clears an optional link or URL
const clearable = (schema) => z.union([z.literal(''), schema]).optional()

// M-131, P3-D6: whole major units in the profile country's currency
const salary = z.object({
  amount: z.number().int().min(P.salary.min).max(P.salary.max),
  currency: z.string().length(3),
  period: z.enum(ENUMS.salaryPeriod),
})

export const entryParams = z.object({ id: objectId })

/** PUT /candidate/profile: the Edit profile dialog (P3-D9). */
export const profileBody = z.object({
  fullName,
  headline: text(P.headline.max),
  placeId,
  about: z.string().trim().min(P.about.min).max(P.about.max),
  yearsExperience: z.number().int().min(P.yearsExperience.min).max(P.yearsExperience.max),
  skills: z.array(text(P.skills.itemMax)).min(P.skills.min).max(P.skills.max),
  workPreference: z.enum(ENUMS.workPreference),
  availability: z.enum(ENUMS.availability),
  salaryMin: salary.nullable().default(null),
})

/** M-018 */
export const workEntryBody = z.object({
  title: entryText,
  employer: entryText,
  start: month,
  end: month.nullable().default(null),
  current: z.boolean().default(false),
  description: optionalText(P.description.max),
})

/** M-019 */
export const educationEntryBody = z.object({
  institution: entryText,
  degree: entryText,
  start: month,
  end: month.nullable().default(null),
  stillStudying: z.boolean().default(false),
})

/** "No work experience yet" / "No formal qualification" */
export const noneBody = z.object({ none: z.boolean() })

/** M-020, P3-D5 */
export const languagesBody = z.object({
  languages: z.array(z.object({ code: z.enum(ISO6391.getAllCodes()), level: z.enum(ENUMS.languageLevel) })).max(P.languages.max),
})

/** M-021, P3-D4 */
export const rightToWorkBody = z.object({
  rightToWork: z
    .array(
      z.object({
        region: z.enum(ENUMS.rtwRegion),
        status: z.enum(ENUMS.rtwStatus),
        permitExpiresOn: z.iso.date().nullable().default(null),
      }),
    )
    .max(P.rightToWork.max),
})

/** M-022 */
export const linksBody = z.object({ linkedin: clearable(linkedin), portfolio: clearable(https) })

/** M-025, P3-D3 */
export const certificateBody = z.object({
  name: entryText,
  issuer: entryText,
  issuedOn: month,
  expiresOn: month.nullable().default(null),
  url: clearable(https),
})

/** M-014: the preferences step (P3-D2) */
export const preferencesBody = z.object({
  workPreference: z.enum(ENUMS.workPreference),
  placeId,
  salaryMin: salary.nullable().default(null),
})

/** M-187 */
export const privacyBody = z.object({
  discoverable: z.boolean().optional(),
  resumeVisible: z.boolean().optional(),
  matchingConsent: z.boolean().optional(),
})
