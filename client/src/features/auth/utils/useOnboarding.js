import { useOutletContext } from 'react-router-dom'

/**
 * Shared onboarding state provided by OnboardingLayout:
 *   data / saveData(patch)      non-sensitive field values (persisted)
 *   completed / completeStep(id) finished step ids (persisted)
 *   secrets / saveSecrets(patch) passwords and OTP codes (memory only, gone on reload)
 */
export function useOnboarding() {
  return useOutletContext()
}
