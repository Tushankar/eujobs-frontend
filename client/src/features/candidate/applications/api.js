import { api } from '@/app/api.js'
import { usePageVisible } from '@/hooks/usePageVisible.js'

/*
 * Candidate applications (§3.4): the apply gate in one request, the list with dated history (M-075), withdraw
 * (M-074) and the counters behind the sidebar badge (M-094). Applying changes job cards, so job lists refetch.
 */
const APPLICATION_CHANGES = ['Applications', 'Counters', 'Jobs', 'SavedJobs', 'CandidateOverview']
const COUNTERS_POLL_MS = 15_000

export const applicationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getApplications: build.query({ query: () => '/candidate/applications', providesTags: ['Applications'] }),
    apply: build.mutation({ query: (body) => ({ url: '/candidate/applications', method: 'POST', body }), invalidatesTags: APPLICATION_CHANGES }),
    withdraw: build.mutation({ query: (id) => ({ url: `/candidate/applications/${id}/withdraw`, method: 'POST' }), invalidatesTags: APPLICATION_CHANGES }),
    getCounters: build.query({ query: () => '/me/counters', providesTags: ['Counters'] }),
  }),
})

export const { useGetApplicationsQuery, useApplyMutation, useWithdrawMutation, useGetCountersQuery } = applicationsApi

/** M-094: one counters request every 15 s, paused while the tab is hidden. */
export function useCounters() {
  const visible = usePageVisible()
  return useGetCountersQuery(undefined, { pollingInterval: visible ? COUNTERS_POLL_MS : 0 }).data
}

/** The Applications sidebar badge: active applications, hidden at 0. */
export function useActiveApplicationsBadge() {
  const count = useCounters()?.activeApplications
  return count ? String(count) : null
}
