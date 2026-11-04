import { api } from '@/app/api.js'

/* Moderation › Candidate verification (M-166) and Account review (M-165, P4-Q2): queues, details and decisions. */
export const moderationApi = api.injectEndpoints({
  endpoints: (build) => ({
    getVerificationQueue: build.query({
      query: (status = 'in_review') => ({ url: '/admin/moderation/verification', params: { status } }),
      providesTags: ['VerificationQueue'],
    }),
    getVerificationSubmission: build.query({ query: (id) => `/admin/moderation/verification/${id}`, providesTags: ['VerificationQueue'] }),
    decideVerification: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/moderation/verification/${id}/decision`, method: 'POST', body }),
      invalidatesTags: ['VerificationQueue'],
    }),
    getAccountQueue: build.query({
      query: (status = 'pending_review') => ({ url: '/admin/moderation/accounts', params: { status } }),
      providesTags: ['AccountReview'],
    }),
    getAccount: build.query({ query: (userId) => `/admin/moderation/accounts/${userId}`, providesTags: ['AccountReview'] }),
    decideAccount: build.mutation({
      query: ({ userId, ...body }) => ({ url: `/admin/moderation/accounts/${userId}/decision`, method: 'POST', body }),
      invalidatesTags: ['AccountReview'],
    }),
    // Content cases (M-164, M-167, OQ-1)
    getModerationSummary: build.query({ query: () => '/admin/moderation/summary', providesTags: ['ContentCases'] }),
    getContentCases: build.query({ query: () => '/admin/moderation/content', providesTags: ['ContentCases'] }),
    getContentCase: build.query({ query: (id) => `/admin/moderation/content/${id}`, providesTags: ['ContentCases'] }),
    decideContentCase: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/moderation/content/${id}/decision`, method: 'POST', body }),
      invalidatesTags: ['ContentCases', 'AdminJobs', 'AdminMetrics'],
    }),
    // A signed URL for a sensitive file (documents.view, §2.6)
    getAdminFileUrl: build.query({ query: (fileId) => `/admin/files/${fileId}`, keepUnusedDataFor: 0 }),
  }),
})

export const {
  useGetVerificationQueueQuery,
  useGetVerificationSubmissionQuery,
  useDecideVerificationMutation,
  useGetAccountQueueQuery,
  useGetAccountQuery,
  useDecideAccountMutation,
  useGetModerationSummaryQuery,
  useGetContentCasesQuery,
  useGetContentCaseQuery,
  useDecideContentCaseMutation,
  useGetAdminFileUrlQuery,
} = moderationApi
