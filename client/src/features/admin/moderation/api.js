import { api } from '@/app/api.js'

/* Moderation › Candidate verification (M-166): the queue, a submission and the decision. */
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
    // A signed URL for a sensitive file (documents.view, §2.6)
    getAdminFileUrl: build.query({ query: (fileId) => `/admin/files/${fileId}`, keepUnusedDataFor: 0 }),
  }),
})

export const { useGetVerificationQueueQuery, useGetVerificationSubmissionQuery, useDecideVerificationMutation, useGetAdminFileUrlQuery } = moderationApi
