import { api } from '@/app/api.js'

/* Candidate job browsing (§3.8): Find jobs in the header country, job details, For you (U8) and saved jobs (M-065). */
const SAVED_CHANGES = ['Jobs', 'SavedJobs', 'CandidateOverview']

export const jobsApi = api.injectEndpoints({
  endpoints: (build) => ({
    searchJobs: build.query({ query: (params) => ({ url: '/jobs', params }), providesTags: ['Jobs'] }),
    getRecommendedJobs: build.query({ query: () => '/jobs/recommended', providesTags: ['Jobs'] }),
    getJob: build.query({ query: (id) => `/jobs/${id}`, providesTags: ['Jobs'] }),
    getSavedJobs: build.query({ query: () => '/candidate/saved-jobs', providesTags: ['SavedJobs'] }),
    saveJob: build.mutation({ query: (id) => ({ url: `/candidate/saved-jobs/${id}`, method: 'PUT' }), invalidatesTags: SAVED_CHANGES }),
    unsaveJob: build.mutation({ query: (id) => ({ url: `/candidate/saved-jobs/${id}`, method: 'DELETE' }), invalidatesTags: SAVED_CHANGES }),
    getCandidateOverview: build.query({ query: () => '/candidate/overview', providesTags: ['CandidateOverview'] }),
  }),
})

export const { useSearchJobsQuery, useGetRecommendedJobsQuery, useGetJobQuery, useGetSavedJobsQuery, useSaveJobMutation, useUnsaveJobMutation, useGetCandidateOverviewQuery } = jobsApi

/** Saves or unsaves a job card. */
export function useSaveToggle() {
  const [save] = useSaveJobMutation()
  const [unsave] = useUnsaveJobMutation()
  return (job) => (job.saved ? unsave(job.id) : save(job.id))
}
