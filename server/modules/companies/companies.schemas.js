import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'
import { email, fullName } from '../auth/auth.schemas.js'
import { placeId } from '../places/places.schemas.js'

/* Recruiter onboarding (M-151 … M-153), the Company page (M-147) and Account review (M-165). Limits: P4-Q3. */
const C = LIMITS.company
const text = ({ min, max }) => z.string().trim().min(min).max(max)

/** P4-Q3: one website rule for both screens; https:// is added when missing and the host must contain a dot. */
export const website = z
  .string()
  .trim()
  .min(1)
  .max(C.website.max)
  .transform((value) => (/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`))
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && url.hostname.includes('.')
    } catch {
      return false
    }
  })

/** Step 1 (M-153, P4-D1): details only; the email cannot change (C21). A national number is read in `country`. */
export const accountBody = z.object({
  fullName,
  jobTitle: z.string().trim().min(1).max(LIMITS.jobTitle.max),
  phone: z.string().trim().min(1).max(32),
  country: z.string().trim().toUpperCase().length(2).optional(),
})

/** Step 2 (M-146, M-149): the display name follows the legal name until approval. */
export const companyBody = z.object({
  legalName: text(C.name),
  website,
  // The email rule already caps it at 254 (C.businessEmail).
  businessEmail: email,
  industry: text(C.industry),
  size: z.enum(ENUMS.companySize),
  placeId,
  businessAddress: text(C.businessAddress),
  registrationDetails: z.string().trim().max(C.registrationDetails.max).optional(),
})

/** The Company page after approval: public fields only (M-147). */
export const companyPatchBody = z.object({
  displayName: text(C.name),
  industry: text(C.industry),
  size: z.enum(ENUMS.companySize),
  placeId,
  website,
  description: text(C.description),
})

/** Multipart field next to the KYC file (M-185). */
export const documentBody = z.object({ type: z.enum(ENUMS.kycDocType) })
export const idParams = z.object({ id: objectId })

/* Account review (P4-Q2) */
export const REVIEW_STATUSES = ['pending_review', 'active', 'suspended', 'rejected']
export const accountsQuery = z.object({ status: z.enum(REVIEW_STATUSES).default('pending_review') })
export const accountParams = z.object({ userId: objectId })
export const accountDecisionBody = z.object({
  decision: z.enum(ENUMS.accountDecision),
  reason: z.string().trim().max(LIMITS.accountDecisionReason.max).optional(),
})
