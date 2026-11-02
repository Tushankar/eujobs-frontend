/** Recruiter onboarding: the five steps (routes from the Figma frames); labels are auth:onboarding.steps.<id>. */
export const ONBOARDING_STEPS = [
  { id: 'account', path: '/recruiter/onboarding/account' },
  { id: 'company', path: '/recruiter/onboarding/company' },
  { id: 'kyc', path: '/recruiter/onboarding/kyc' },
  { id: 'verify', path: '/recruiter/onboarding/verify' },
  { id: 'review', path: '/recruiter/onboarding/review' },
]

export const stepPath = (id) => ONBOARDING_STEPS.find((step) => step.id === id).path
