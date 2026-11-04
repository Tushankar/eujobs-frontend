import { api } from '@/app/api.js'

/*
 * Admin > Jobs (P9-Q5): the minimal real list and each job's AI summary in the admin's language, with Regenerate
 * (M-058; not counted, U3); every status with its filters and pages, and "Open case" (M-046, P10-Q4).
 */
export const adminJobsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminJobs: build.query({ query: (params) => ({ url: '/admin/jobs', params }), providesTags: ['AdminJobs'] }),
    // M-164, P10-Q4: answers the job's open case (new or existing).
    openJobCase: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/case`, method: 'POST', body }),
      invalidatesTags: ['AdminJobs', 'ContentCases'],
    }),
    getAdminJobSummary: build.query({ query: (id) => `/admin/jobs/${id}/ai-summary` }),
    regenerateAdminJobSummary: build.mutation({
      query: (id) => ({ url: `/admin/jobs/${id}/ai-summary/regenerate`, method: 'POST' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(adminJobsApi.util.upsertQueryData('getAdminJobSummary', id, data))
        } catch {
          // The dialog shows the failure.
        }
      },
    }),
  }),
})

export const { useGetAdminJobsQuery, useGetAdminJobSummaryQuery, useRegenerateAdminJobSummaryMutation, useOpenJobCaseMutation } = adminJobsApi
