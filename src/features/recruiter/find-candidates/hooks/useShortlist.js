import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'

export const SHORTLIST_STORAGE_KEY = 'lwm.recruiter.shortlist'

// The Figma Find candidates frame opens with Oliver Park and James Chen already shortlisted.
const DEFAULT_SHORTLIST = ['oliver-park', 'james-chen']

/**
 * Shortlisted candidate ids, shared by every component that calls it (Find candidates, the candidate
 * profile, Shortlists ...) and persisted on this device. `toggle(id)` shortlists or removes a candidate.
 */
export function useShortlist() {
  const [shortlistedIds, setShortlistedIds] = useSharedLocalStorage(SHORTLIST_STORAGE_KEY, DEFAULT_SHORTLIST)

  const isShortlisted = (id) => shortlistedIds.includes(id)

  function toggle(id) {
    setShortlistedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  return { shortlistedIds, isShortlisted, toggle }
}
