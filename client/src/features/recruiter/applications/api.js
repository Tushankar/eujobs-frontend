import { api } from '@/app/api.js'

/*
 * The recruiter's applications and pipeline (§3.4): the table and board rows, stage moves and rejection (M-070,
 * M-090), Manage stages (M-072, OD5) and the Overview's funnel and momentum (M-178, M-083, M-170). A move changes
 * the board, the stage counts, the Overview numbers and the candidate's activity timeline.
 */
const MOVE_CHANGES = ['CompanyApplications', 'Pipeline', 'RecruiterOverview', 'CandidateActivity', 'Discovery']

export const recruiterApplicationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCompanyApplications: build.query({ query: (params) => ({ url: '/recruiter/applications', params }), providesTags: ['CompanyApplications'] }),
    // P11b-Q9: one row, any status, for a notification's deep link.
    getCompanyApplication: build.query({ query: (id) => `/recruiter/applications/${id}`, providesTags: ['CompanyApplications'] }),
    moveApplication: build.mutation({ query: ({ id, stageId }) => ({ url: `/recruiter/applications/${id}/stage`, method: 'PATCH', body: { stageId } }), invalidatesTags: MOVE_CHANGES }),
    rejectApplication: build.mutation({ query: ({ id, notify }) => ({ url: `/recruiter/applications/${id}/reject`, method: 'POST', body: { notify } }), invalidatesTags: MOVE_CHANGES }),
    getPipeline: build.query({ query: () => '/recruiter/pipeline', providesTags: ['Pipeline'] }),
    addStage: build.mutation({ query: (body) => ({ url: '/recruiter/pipeline/stages', method: 'POST', body }), invalidatesTags: ['Pipeline', 'RecruiterOverview'] }),
    updateStage: build.mutation({ query: ({ id, ...body }) => ({ url: `/recruiter/pipeline/stages/${id}`, method: 'PATCH', body }), invalidatesTags: ['Pipeline', 'CompanyApplications', 'RecruiterOverview'] }),
    removeStage: build.mutation({ query: (id) => ({ url: `/recruiter/pipeline/stages/${id}`, method: 'DELETE' }), invalidatesTags: ['Pipeline', 'RecruiterOverview'] }),
    reorderStages: build.mutation({ query: (ids) => ({ url: '/recruiter/pipeline/stages/order', method: 'PUT', body: { ids } }), invalidatesTags: ['Pipeline', 'RecruiterOverview'] }),
    getFunnel: build.query({ query: () => '/recruiter/overview/funnel', providesTags: ['RecruiterOverview'] }),
    getMomentum: build.query({ query: (params) => ({ url: '/recruiter/overview/momentum', params }), providesTags: ['RecruiterOverview'] }),
  }),
})

export const {
  useGetCompanyApplicationsQuery,
  useGetCompanyApplicationQuery,
  useMoveApplicationMutation,
  useRejectApplicationMutation,
  useGetPipelineQuery,
  useAddStageMutation,
  useUpdateStageMutation,
  useRemoveStageMutation,
  useReorderStagesMutation,
  useGetFunnelQuery,
  useGetMomentumQuery,
} = recruiterApplicationsApi
