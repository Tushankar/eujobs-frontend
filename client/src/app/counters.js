import { useSelector } from 'react-redux'
import { usePageVisible } from '@/hooks/usePageVisible.js'
import { api } from './api.js'

/*
 * GET /me/counters (M-094): one request every 15 s for every badge of the workspace, paused while the tab is hidden.
 * Candidates get unread messages and active applications, recruiters unread messages.
 */
const COUNTERS_POLL_MS = 15_000

const countersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCounters: build.query({ query: () => '/me/counters', providesTags: ['Counters'] }),
  }),
})

export function useCounters() {
  const visible = usePageVisible()
  // Signed out (sign-out, account deleted): no poll, so the cache reset does not refetch it without a session.
  const signedIn = useSelector((state) => state.session.signedIn)
  return countersApi.useGetCountersQuery(undefined, { pollingInterval: visible ? COUNTERS_POLL_MS : 0, skip: !signedIn }).data
}
