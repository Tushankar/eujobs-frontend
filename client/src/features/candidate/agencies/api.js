import { api } from '@/app/api.js'
import { useCounters } from '@/app/counters.js'

/*
 * 2026-11-20 (agencies, phase 5): the candidate's agencies (joining, the agreement, leaving), their placements and
 * re-hire offers, and the rule check for one job. Changes refresh job cards too (the Join button, the lock).
 */
const BOOKS = ['CandidateAgencies', 'Counters', 'Jobs']
const PLACEMENTS = ['CandidatePlacements', 'Counters', 'Jobs']

export const candidateAgenciesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMyAgencies: build.query({ query: () => '/candidate/agencies', providesTags: ['CandidateAgencies'] }),
    joinAgency: build.mutation({ query: (companyId) => ({ url: `/candidate/agencies/${companyId}/join`, method: 'POST' }), invalidatesTags: BOOKS }),
    getAgencyAgreement: build.query({ query: (id) => `/candidate/agencies/memberships/${id}/agreement`, providesTags: ['CandidateAgencies'] }),
    agreeToAgreement: build.mutation({ query: ({ id, version }) => ({ url: `/candidate/agencies/memberships/${id}/agree`, method: 'POST', body: { version } }), invalidatesTags: BOOKS }),
    // decline (a request or an invitation) or end (leave the books)
    membershipAction: build.mutation({ query: ({ id, action }) => ({ url: `/candidate/agencies/memberships/${id}/${action}`, method: 'POST' }), invalidatesTags: BOOKS }),

    getMyPlacements: build.query({ query: () => '/candidate/placements', providesTags: ['CandidatePlacements'] }),
    // accept or decline a re-hire offer, or give notice
    placementAction: build.mutation({ query: ({ id, action }) => ({ url: `/candidate/placements/${id}/${action}`, method: 'POST' }), invalidatesTags: PLACEMENTS }),
    checkJob: build.query({ query: (jobId) => ({ url: '/candidate/placements/check', params: { jobId } }), providesTags: ['CandidatePlacements'] }),
  }),
})

export const {
  useGetMyAgenciesQuery,
  useJoinAgencyMutation,
  useGetAgencyAgreementQuery,
  useAgreeToAgreementMutation,
  useMembershipActionMutation,
  useGetMyPlacementsQuery,
  usePlacementActionMutation,
  useCheckJobQuery,
} = candidateAgenciesApi

/** The Agencies sidebar badge: re-hire offers and agreements waiting for the candidate, hidden at 0. */
export function useAgencyActionsBadge() {
  const count = useCounters()?.agencyActions
  return count ? String(count) : null
}
