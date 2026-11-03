import { api } from '@/app/api.js'
import { useCounters } from '@/app/counters.js'

/*
 * Candidate applications (§3.4): the apply gate in one request, the list with dated history (M-075), withdraw
 * (M-074) and the sidebar badge from the shared counters (M-094). Applying changes job cards, so job lists refetch.
 */
const APPLICATION_CHANGES = ['Applications', 'Counters', 'Jobs', 'SavedJobs', 'CandidateOverview']

export const applicationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getApplications: build.query({ query: () => '/candidate/applications', providesTags: ['Applications'] }),
    apply: build.mutation({ query: (body) => ({ url: '/candidate/applications', method: 'POST', body }), invalidatesTags: APPLICATION_CHANGES }),
    withdraw: build.mutation({ query: (id) => ({ url: `/candidate/applications/${id}/withdraw`, method: 'POST' }), invalidatesTags: APPLICATION_CHANGES }),
  }),
})

export const { useGetApplicationsQuery, useApplyMutation, useWithdrawMutation } = applicationsApi

/** The Applications sidebar badge: active applications, hidden at 0. */
export function useActiveApplicationsBadge() {
  const count = useCounters()?.activeApplications
  return count ? String(count) : null
}
