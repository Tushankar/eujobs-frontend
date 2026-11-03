import { api } from '@/app/api.js'

/*
 * Admin > Jobs (P9-Q5): the minimal real list and each job's AI summary in the admin's language, with Regenerate
 * (M-058; not counted, U3). Phase 10 adds the status filter, pagination and "Open case".
 */
export const adminJobsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminJobs: build.query({ query: () => '/admin/jobs', providesTags: ['AdminJobs'] }),
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

export const { useGetAdminJobsQuery, useGetAdminJobSummaryQuery, useRegenerateAdminJobSummaryMutation } = adminJobsApi
