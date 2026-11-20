import { hiringPath } from '@/app/roles.js'
/**
 * Recruiter and agency onboarding: the five steps (routes from the Figma frames); labels are auth:onboarding.steps.<id>.
 * Paths are in the account's own workspace (/recruiter/onboarding/…, /agency/onboarding/…).
 */
export const stepPath = (id) => hiringPath(`onboarding/${id}`)

export const ONBOARDING_STEPS = ['account', 'company', 'kyc', 'verify', 'review'].map((id) => ({
  id,
  get path() {
    return stepPath(id)
  },
}))
