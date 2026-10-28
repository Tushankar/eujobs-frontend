import { useCallback } from 'react'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { SEED_SAVED_JOB_IDS } from '../data/applications.js'

/** Saved job ids, persisted on this device and shared by every page that shows a bookmark. */
export function useSavedJobs() {
  const [savedIds, setSavedIds] = useSharedLocalStorage('lwm.candidate.savedJobs', SEED_SAVED_JOB_IDS)

  const toggleSaved = useCallback(
    (jobId) => setSavedIds((current) => (current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId])),
    [setSavedIds],
  )

  return { savedIds, isSaved: (jobId) => savedIds.includes(jobId), toggleSaved }
}
