import { api, formData } from '@/app/api.js'
import { celebrate } from '@/app/celebrate.js'

/*
 * 2026-11-20: the agency's own API: clients, the agreement (versions and rules), the candidates on the books,
 * placements, and a job's contract. Every change refreshes what shows it.
 */
const JOB_CHANGES = ['RecruiterJobs', 'RecruiterOverview']

/*
 * 2026-11-23 (owner: "when I invite and all, show a proper modal: invite sent…"): the success modal after an action that
 * worked, from whichever button ran it. `moment(data, arg)` names it (or null for none).
 */
const celebrating = (moment) => async (arg, { dispatch, queryFulfilled }) => {
  try {
    const next = moment((await queryFulfilled).data, arg)
    if (next) dispatch(celebrate(next))
  } catch {
    // The button that ran it shows the failure.
  }
}
const offerSent = celebrating((placement) => ({ kind: 'placement_offer_sent', params: { name: placement.candidate.name ?? '', job: placement.job.title ?? '' } }))

export const agencyApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Clients
    getClients: build.query({ query: () => '/agency/clients', providesTags: ['AgencyClients'] }),
    createClient: build.mutation({ query: (body) => ({ url: '/agency/clients', method: 'POST', body }), invalidatesTags: ['AgencyClients'] }),
    updateClient: build.mutation({ query: ({ id, body }) => ({ url: `/agency/clients/${id}`, method: 'PUT', body }), invalidatesTags: ['AgencyClients'] }),
    deleteClient: build.mutation({ query: (id) => ({ url: `/agency/clients/${id}`, method: 'DELETE' }), invalidatesTags: ['AgencyClients'] }),
    uploadClientLogo: build.mutation({ query: ({ id, file }) => ({ url: `/agency/clients/${id}/logo`, method: 'POST', body: formData(file) }), invalidatesTags: ['AgencyClients'] }),
    removeClientLogo: build.mutation({ query: (id) => ({ url: `/agency/clients/${id}/logo`, method: 'DELETE' }), invalidatesTags: ['AgencyClients'] }),
    searchClientCompanies: build.query({ query: (q) => ({ url: '/agency/clients/companies', params: { q } }), transformResponse: (response) => response.items }),

    // The agreement: every change answers with the whole overview
    getAgreement: build.query({ query: () => '/agency/agreement', providesTags: ['AgencyAgreement'] }),
    uploadAgreement: build.mutation({ query: (file) => ({ url: '/agency/agreement', method: 'POST', body: formData(file) }), invalidatesTags: ['AgencyAgreement'] }),
    readAgreement: build.mutation({ query: () => ({ url: '/agency/agreement/draft/read', method: 'POST' }), invalidatesTags: ['AgencyAgreement', 'Me'] }),
    saveAgreementRules: build.mutation({ query: (rules) => ({ url: '/agency/agreement/draft/rules', method: 'PUT', body: rules }), invalidatesTags: ['AgencyAgreement'] }),
    publishAgreement: build.mutation({
      query: () => ({ url: '/agency/agreement/draft/publish', method: 'POST' }),
      invalidatesTags: ['AgencyAgreement', 'AgencyTalent'],
      onQueryStarted: celebrating(({ current }) => current && { kind: current.version > 1 ? 'agreement_version_published' : 'agreement_published', params: { version: current.version, count: current.onBooks } }),
    }),
    deleteAgreementDraft: build.mutation({ query: () => ({ url: '/agency/agreement/draft', method: 'DELETE' }), invalidatesTags: ['AgencyAgreement'] }),

    // The books
    // 2026-11-23: not "getTalent": that name is the recruiter Overview's list on the same api (one cache entry, so the
    // Overview read the agency's books as candidates and crashed).
    getBooks: build.query({ query: () => '/agency/talent', providesTags: ['AgencyTalent'] }),
    inviteTalent: build.mutation({
      query: (candidateId) => ({ url: '/agency/talent/invite', method: 'POST', body: { candidateId } }),
      invalidatesTags: ['AgencyTalent'],
      // Inviting someone who already asked accepts their request instead (the server answers with their request).
      onQueryStarted: celebrating((member) => ({ kind: member.requestedBy === 'candidate' ? 'books_request_accepted' : 'books_invite_sent', params: { name: member.candidate.name ?? '' } })),
    }),
    // 2026-11-23: also the applications list, whose rows show each applicant's place on the books.
    talentAction: build.mutation({
      query: ({ id, action }) => ({ url: `/agency/talent/${id}/${action}`, method: 'POST' }),
      invalidatesTags: ['AgencyTalent', 'AgencyAgreement', 'CompanyApplications'],
      onQueryStarted: celebrating((member, { action }) => action === 'accept' && { kind: 'books_request_accepted', params: { name: member.candidate.name ?? '' } }),
    }),
    // Phase 6: the books ranked for one agency job, and AI reasons beside them (Agency Plus)
    getTalentRanking: build.query({ query: (jobId) => ({ url: '/agency/talent/ranking', params: { jobId } }), providesTags: ['AgencyTalent', 'AgencyPlacements'] }),
    talentReasons: build.mutation({ query: (jobId) => ({ url: '/agency/talent/ranking/reasons', method: 'POST', body: { jobId } }), invalidatesTags: ['AiUsage'] }),

    // Placements
    getPlacements: build.query({ query: () => '/agency/placements', providesTags: ['AgencyPlacements'] }),
    endPlacement: build.mutation({ query: ({ id, endDate }) => ({ url: `/agency/placements/${id}/end`, method: 'POST', body: { endDate } }), invalidatesTags: ['AgencyPlacements'] }),
    rehire: build.mutation({ query: ({ id, jobId }) => ({ url: `/agency/placements/${id}/rehire`, method: 'POST', body: { jobId } }), invalidatesTags: ['AgencyPlacements'], onQueryStarted: offerSent }),
    // Phase 6: an offer straight to someone on the books
    offerPlacement: build.mutation({ query: (body) => ({ url: '/agency/placements/offer', method: 'POST', body }), invalidatesTags: ['AgencyPlacements'], onQueryStarted: offerSent }),
    withdrawOffer: build.mutation({ query: (id) => ({ url: `/agency/placements/${id}/withdraw`, method: 'POST' }), invalidatesTags: ['AgencyPlacements'] }),

    // A job's contract
    uploadContract: build.mutation({ query: ({ jobId, file }) => ({ url: `/recruiter/jobs/${jobId}/contract`, method: 'POST', body: formData(file) }), invalidatesTags: JOB_CHANGES }),
    removeContract: build.mutation({ query: (jobId) => ({ url: `/recruiter/jobs/${jobId}/contract`, method: 'DELETE' }), invalidatesTags: JOB_CHANGES }),
    readContract: build.mutation({ query: (jobId) => ({ url: `/recruiter/jobs/${jobId}/contract/read`, method: 'POST' }), invalidatesTags: [...JOB_CHANGES, 'Me'] }),
    confirmContractRules: build.mutation({ query: ({ jobId, rules }) => ({ url: `/recruiter/jobs/${jobId}/contract/rules`, method: 'PUT', body: rules }), invalidatesTags: JOB_CHANGES }),
    getContractUrl: build.query({ query: (jobId) => `/recruiter/jobs/${jobId}/contract`, keepUnusedDataFor: 0 }),
  }),
})

export const {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  useUploadClientLogoMutation,
  useRemoveClientLogoMutation,
  useSearchClientCompaniesQuery,
  useGetAgreementQuery,
  useUploadAgreementMutation,
  useReadAgreementMutation,
  useSaveAgreementRulesMutation,
  usePublishAgreementMutation,
  useDeleteAgreementDraftMutation,
  useGetBooksQuery,
  useInviteTalentMutation,
  useTalentActionMutation,
  useGetTalentRankingQuery,
  useTalentReasonsMutation,
  useGetPlacementsQuery,
  useEndPlacementMutation,
  useRehireMutation,
  useOfferPlacementMutation,
  useWithdrawOfferMutation,
  useUploadContractMutation,
  useRemoveContractMutation,
  useReadContractMutation,
  useConfirmContractRulesMutation,
  useLazyGetContractUrlQuery,
} = agencyApi
