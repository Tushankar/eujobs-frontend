import { api } from '@/app/api.js'

/* Candidate job browsing (§3.8): Find jobs in the header country, job details, For you (U8) and saved jobs (M-065). */
// 2026-11-24: 'Jobs' is no longer invalidated: the job lists and details are patched in place (optimisticSaved), so
// a bookmark does not refetch every cached search. The Saved tab and the overview count still refetch.
const SAVED_CHANGES = ['SavedJobs', 'CandidateOverview']
const SAVED_FLAG_QUERIES = ['searchJobs', 'getRecommendedJobs', 'getSavedJobs', 'getJob']

/** Flips `saved` on every cached copy of the job at once (cards, details, Saved tab); undone when the request fails. */
const optimisticSaved = (saved) =>
  async function onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
    const patches = []
    for (const endpoint of SAVED_FLAG_QUERIES) {
      for (const args of jobsApi.util.selectCachedArgsForQuery(getState(), endpoint)) {
        if (endpoint === 'getJob' && args !== id) continue
        const patch = jobsApi.util.updateQueryData(endpoint, args, (draft) => {
          if (!draft) return
          if (endpoint === 'getJob') draft.saved = saved
          else for (const job of draft.items ?? []) if (job.id === id) job.saved = saved
        })
        patches.push(dispatch(patch))
      }
    }
    try {
      await queryFulfilled
    } catch {
      for (const patch of patches) patch.undo()
    }
  }

export const jobsApi = api.injectEndpoints({
  endpoints: (build) => ({
    searchJobs: build.query({ query: (params) => ({ url: '/jobs', params }), providesTags: ['Jobs'] }),
    getRecommendedJobs: build.query({ query: () => '/jobs/recommended', providesTags: ['Jobs'] }),
    getJob: build.query({ query: (id) => `/jobs/${id}`, providesTags: ['Jobs'] }),
    getSavedJobs: build.query({ query: () => '/candidate/saved-jobs', providesTags: ['SavedJobs'] }),
    saveJob: build.mutation({ query: (id) => ({ url: `/candidate/saved-jobs/${id}`, method: 'PUT' }), invalidatesTags: SAVED_CHANGES, onQueryStarted: optimisticSaved(true) }),
    unsaveJob: build.mutation({ query: (id) => ({ url: `/candidate/saved-jobs/${id}`, method: 'DELETE' }), invalidatesTags: SAVED_CHANGES, onQueryStarted: optimisticSaved(false) }),
    getCandidateOverview: build.query({ query: () => '/candidate/overview', providesTags: ['CandidateOverview'] }),
  }),
})

export const { useSearchJobsQuery, useGetRecommendedJobsQuery, useGetJobQuery, useGetSavedJobsQuery, useSaveJobMutation, useUnsaveJobMutation, useGetCandidateOverviewQuery } = jobsApi

// Jobs with a save or unsave on its way: a second click waits for the answer instead of sending the opposite.
const savingJobs = new Set()

/** Saves or unsaves a job card. */
export function useSaveToggle() {
  const [save] = useSaveJobMutation()
  const [unsave] = useUnsaveJobMutation()
  return async (job) => {
    if (savingJobs.has(job.id)) return
    savingJobs.add(job.id)
    try {
      await (job.saved ? unsave(job.id) : save(job.id))
    } finally {
      savingJobs.delete(job.id)
    }
  }
}
