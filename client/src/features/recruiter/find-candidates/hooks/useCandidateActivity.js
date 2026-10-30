import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'

export const CANDIDATE_ACTIVITY_STORAGE_KEY = 'lwm.recruiter.candidate-activity'

const NO_ACTIVITY = {}

/**
 * What the recruiter has done on a candidate, keyed by candidate id, newest first:
 * `{ id, type, text, at }` (type: 'outreach' | 'cv-request' | 'stage'; at: ISO time). Persisted on this device. Nothing here is ever sent to the candidate.
 */
export function useCandidateActivity() {
  const [activity, setActivity] = useSharedLocalStorage(CANDIDATE_ACTIVITY_STORAGE_KEY, NO_ACTIVITY)

  return {
    getActivity: (candidateId) => activity[candidateId] ?? [],
    addActivity: (candidateId, type, text) =>
      setActivity((current) => ({
        ...current,
        [candidateId]: [
          { id: `${candidateId}-${Date.now().toString(36)}`, type, text, at: new Date().toISOString() },
          ...(current[candidateId] ?? []),
        ],
      })),
  }
}
