import { api, formData } from '@/app/api.js'

/*
 * 2026-11-20: the agency's own API: clients, the agreement (versions and rules), the candidates on the books,
 * placements, and a job's contract. Every change refreshes what shows it.
 */
const JOB_CHANGES = ['RecruiterJobs', 'RecruiterOverview']

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
    publishAgreement: build.mutation({ query: () => ({ url: '/agency/agreement/draft/publish', method: 'POST' }), invalidatesTags: ['AgencyAgreement', 'AgencyTalent'] }),
    deleteAgreementDraft: build.mutation({ query: () => ({ url: '/agency/agreement/draft', method: 'DELETE' }), invalidatesTags: ['AgencyAgreement'] }),

    // The books
    getTalent: build.query({ query: () => '/agency/talent', providesTags: ['AgencyTalent'] }),
    inviteTalent: build.mutation({ query: (candidateId) => ({ url: '/agency/talent/invite', method: 'POST', body: { candidateId } }), invalidatesTags: ['AgencyTalent'] }),
    // 2026-11-23: also the applications list, whose rows show each applicant's place on the books.
    talentAction: build.mutation({ query: ({ id, action }) => ({ url: `/agency/talent/${id}/${action}`, method: 'POST' }), invalidatesTags: ['AgencyTalent', 'AgencyAgreement', 'CompanyApplications'] }),
    // Phase 6: the books ranked for one agency job, and AI reasons beside them (Agency Plus)
    getTalentRanking: build.query({ query: (jobId) => ({ url: '/agency/talent/ranking', params: { jobId } }), providesTags: ['AgencyTalent', 'AgencyPlacements'] }),
    talentReasons: build.mutation({ query: (jobId) => ({ url: '/agency/talent/ranking/reasons', method: 'POST', body: { jobId } }), invalidatesTags: ['AiUsage'] }),

    // Placements
    getPlacements: build.query({ query: () => '/agency/placements', providesTags: ['AgencyPlacements'] }),
    endPlacement: build.mutation({ query: ({ id, endDate }) => ({ url: `/agency/placements/${id}/end`, method: 'POST', body: { endDate } }), invalidatesTags: ['AgencyPlacements'] }),
    rehire: build.mutation({ query: ({ id, jobId }) => ({ url: `/agency/placements/${id}/rehire`, method: 'POST', body: { jobId } }), invalidatesTags: ['AgencyPlacements'] }),
    // Phase 6: an offer straight to someone on the books
    offerPlacement: build.mutation({ query: (body) => ({ url: '/agency/placements/offer', method: 'POST', body }), invalidatesTags: ['AgencyPlacements'] }),
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
  useGetTalentQuery,
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
