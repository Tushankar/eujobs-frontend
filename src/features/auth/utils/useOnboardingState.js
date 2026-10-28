import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { EMPTY_ONBOARDING_DATA } from '../data/onboarding.js'

/**
 * Recruiter onboarding progress, persisted on this device:
 *   lwm.onboarding.data       non-sensitive field values (never passwords or OTP codes)
 *   lwm.onboarding.completed  ids of the steps the user has completed
 */
export function useOnboardingState() {
  const [stored, setStored] = useLocalStorage('lwm.onboarding.data', EMPTY_ONBOARDING_DATA)
  const [completed, setCompleted] = useLocalStorage('lwm.onboarding.completed', [])

  const saveData = useCallback((patch) => setStored((current) => ({ ...current, ...patch })), [setStored])
  const completeStep = useCallback(
    (stepId) => setCompleted((current) => (current.includes(stepId) ? current : [...current, stepId])),
    [setCompleted],
  )

  return {
    data: {
      ...EMPTY_ONBOARDING_DATA,
      ...stored,
      documents: { ...EMPTY_ONBOARDING_DATA.documents, ...stored.documents },
    },
    saveData,
    completed,
    completeStep,
  }
}
