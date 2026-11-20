import { IANAZone } from 'luxon'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'

/* Password rules beyond "present" run in the service (checkPassword), which needs the email. */
export const email = z.string().trim().toLowerCase().max(LIMITS.email.max).pipe(z.email())
export const timezone = z.string().refine((value) => IANAZone.isValidZone(value))
export const fullName = z.string().trim().min(1).max(LIMITS.fullName.max)
const password = z.string().min(1)

const registration = {
  fullName,
  email,
  password,
  acceptTerms: z.literal(true),
  language: z.enum(ENUMS.language),
  languageExplicit: z.boolean().default(false),
  country: z.string().trim().toUpperCase(),
  timezone: timezone.optional(),
}

export const candidateRegisterBody = z.object(registration)

export const recruiterRegisterBody = z.object({
  ...registration,
  jobTitle: z.string().trim().min(1).max(LIMITS.jobTitle.max),
  phone: z.string().trim().min(1),
})

// 2026-11-20: an agency signs up with the same details as a recruiter (/agencies/signup).
export const agencyRegisterBody = recruiterRegisterBody

export const loginBody = z.object({
  email,
  password,
  portal: z.enum(['candidate', 'recruiter', 'admin', 'agency']),
  timezone: timezone.optional(),
  // 2026-11-18: the key of a browser that passed the sign-in second step before
  deviceToken: z.string().max(200).optional(),
})

// 2026-11-18: the sign-in second step
export const challengeBody = z.object({ challenge: z.string().min(1).max(200) })
export const loginVerifyBody = z.object({ challenge: z.string().min(1).max(200), code: z.string().trim().min(1).max(20) })

export const tokenBody = z.object({ token: z.string().min(1) })
export const emailBody = z.object({ email })
export const codeBody = z.object({ code: z.string().regex(new RegExp(`^\\d{${LIMITS.code.length}}$`)) })
export const resetBody = z.object({ token: z.string().min(1), password })
