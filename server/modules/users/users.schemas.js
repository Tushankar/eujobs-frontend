import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { fullName, timezone } from '../auth/auth.schemas.js'

export const mePatchBody = z.object({
  fullName: fullName.optional(),
  language: z.enum(ENUMS.language).optional(),
  languageExplicit: z.boolean().optional(),
  theme: z.enum(ENUMS.theme).optional(),
  pickerCountry: z.string().trim().toUpperCase().optional(),
  jobsWorldwide: z.boolean().optional(),
  timezone: timezone.optional(),
})

export const passwordChangeBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
})
