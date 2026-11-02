import { api, writesMe } from '@/app/api.js'
import { writesProfile } from '../profile/api.js'

/* Candidate onboarding (M-014): the preferences step and completion. */
export const onboardingApi = api.injectEndpoints({
  endpoints: (build) => ({
    savePreferences: build.mutation({ query: (body) => ({ url: '/candidate/onboarding/preferences', method: 'PUT', body }), ...writesProfile }),
    // Ends onboarding and answers with the new /me (the header country follows the profile, M-136).
    completeOnboarding: build.mutation({ query: () => ({ url: '/candidate/onboarding/complete', method: 'POST' }), ...writesMe }),
  }),
})

export const { useSavePreferencesMutation, useCompleteOnboardingMutation } = onboardingApi
