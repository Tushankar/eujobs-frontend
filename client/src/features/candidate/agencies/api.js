import { api } from '@/app/api.js'
import { celebrate } from '@/app/celebrate.js'
import { useCounters } from '@/app/counters.js'

/*
 * 2026-11-20 (agencies, phase 5): the candidate's agencies (joining, the agreement, leaving), their placements and
 * re-hire offers, and the rule check for one job. Changes refresh job cards too (the Join button, the lock).
 */
const BOOKS = ['CandidateAgencies', 'Counters', 'Jobs']
const PLACEMENTS = ['CandidatePlacements', 'Counters', 'Jobs']

/** 2026-11-23 (owner): the success modal after an action that worked, from any button that ran it (null: none). */
const celebrating = (moment) => async (arg, { dispatch, queryFulfilled }) => {
  try {
    const next = moment((await queryFulfilled).data, arg)
    if (next) dispatch(celebrate(next))
  } catch {
    // The button that ran it shows the failure.
  }
}

export const candidateAgenciesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMyAgencies: build.query({ query: () => '/candidate/agencies', providesTags: ['CandidateAgencies'] }),
    joinAgency: build.mutation({
      // `companyId`, or { companyId, quiet } (quiet: no modal, e.g. joining along with an application, which has its own).
      query: (arg) => ({ url: `/candidate/agencies/${arg.companyId ?? arg}/join`, method: 'POST' }),
      invalidatesTags: BOOKS,
      // A request waits for the agency; accepting an invitation goes straight on to the agreement instead.
      onQueryStarted: celebrating((membership, arg) => !arg.quiet && membership.status === 'requested' && { kind: 'books_join_requested', params: { agency: membership.agency.displayName } }),
    }),
    getAgencyAgreement: build.query({ query: (id) => `/candidate/agencies/memberships/${id}/agreement`, providesTags: ['CandidateAgencies'] }),
    agreeToAgreement: build.mutation({
      query: ({ id, version }) => ({ url: `/candidate/agencies/memberships/${id}/agree`, method: 'POST', body: { version } }),
      invalidatesTags: BOOKS,
      onQueryStarted: celebrating((membership, { version }) => ({ kind: 'agreement_agreed', params: { agency: membership.agency.displayName, version } })),
    }),
    // decline (a request or an invitation) or end (leave the books)
    membershipAction: build.mutation({ query: ({ id, action }) => ({ url: `/candidate/agencies/memberships/${id}/${action}`, method: 'POST' }), invalidatesTags: BOOKS }),

    getMyPlacements: build.query({ query: () => '/candidate/placements', providesTags: ['CandidatePlacements'] }),
    // accept or decline a re-hire offer, or give notice
    placementAction: build.mutation({
      query: ({ id, action }) => ({ url: `/candidate/placements/${id}/${action}`, method: 'POST' }),
      invalidatesTags: PLACEMENTS,
      onQueryStarted: celebrating((placement, { action }) => action === 'accept' && { kind: 'placement_accepted', params: { job: placement.job.title ?? '', agency: placement.agency.displayName, startDate: placement.startDate } }),
    }),
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
