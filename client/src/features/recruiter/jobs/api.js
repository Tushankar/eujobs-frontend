import { api } from '@/app/api.js'

/*
 * Recruiter jobs (§3.7): list with status counts, wizard drafts, live edits, status changes, quality checks,
 * skill suggestions and relevant talent. A job change also refreshes the Overview and discovery (overlap, counts).
 */
const JOB_CHANGES = ['RecruiterJobs', 'RecruiterOverview', 'Discovery']

export const recruiterJobsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRecruiterJobs: build.query({ query: () => '/recruiter/jobs', providesTags: ['RecruiterJobs'] }),
    getRecruiterJob: build.query({ query: (id) => `/recruiter/jobs/${id}`, providesTags: ['RecruiterJobs'] }),
    createJob: build.mutation({ query: (body) => ({ url: '/recruiter/jobs', method: 'POST', body }), invalidatesTags: JOB_CHANGES }),
    updateJob: build.mutation({ query: ({ id, body }) => ({ url: `/recruiter/jobs/${id}`, method: 'PUT', body }), invalidatesTags: JOB_CHANGES }),
    setJobStatus: build.mutation({ query: ({ id, status }) => ({ url: `/recruiter/jobs/${id}/status`, method: 'PATCH', body: { status } }), invalidatesTags: JOB_CHANGES }),
    deleteJob: build.mutation({ query: (id) => ({ url: `/recruiter/jobs/${id}`, method: 'DELETE' }), invalidatesTags: JOB_CHANGES }),
    getQualityChecks: build.query({ query: (body) => ({ url: '/recruiter/jobs/quality-checks', method: 'POST', body }), transformResponse: (response) => response.items }),
    getSkillSuggestions: build.query({ query: (q) => ({ url: '/skills/suggestions', params: { q } }), transformResponse: (response) => response.items }),
    getRelevantTalent: build.query({ query: (id) => `/recruiter/jobs/${id}/relevant-talent`, providesTags: ['RecruiterJobs', 'Discovery'] }),
  }),
})

export const {
  useGetRecruiterJobsQuery,
  useGetRecruiterJobQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useSetJobStatusMutation,
  useDeleteJobMutation,
  useGetQualityChecksQuery,
  useGetSkillSuggestionsQuery,
  useGetRelevantTalentQuery,
} = recruiterJobsApi
