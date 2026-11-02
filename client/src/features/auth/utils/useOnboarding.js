import { useOutletContext } from 'react-router-dom'

/** The onboarding state from GET /recruiter/onboarding, provided by OnboardingLayout: { state }. */
export function useOnboarding() {
  return useOutletContext()
}
