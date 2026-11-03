import { api } from '@/app/api.js'

/*
 * Every AI request of the app (§3.18, M-057 … M-062, M-144). Texts come from OpenAI and are cached on the server per
 * facts and language, so asking again is free; a candidate without Plus gets 402, which opens the upgrade dialog.
 */
export const aiApi = api.injectEndpoints({
  endpoints: (build) => ({
    // AI insights (Plus): code evidence per page; the narrative is its own request so the evidence survives a failure.
    getInsightsOverview: build.query({ query: () => '/candidate/insights/overview', providesTags: ['Insights'] }),
    getInsightRoles: build.query({ query: () => '/candidate/insights/roles', providesTags: ['Insights'] }),
    getInsightPage: build.query({ query: ({ page, jobId }) => ({ url: `/candidate/insights/${page}`, params: jobId ? { jobId } : {} }), providesTags: ['Insights'] }),
    getInsightNarrative: build.query({ query: ({ section, jobId }) => ({ url: '/candidate/insights/narrative', params: { section, ...(jobId && { jobId }) } }) }),
    saveExplanationFeedback: build.mutation({ query: ({ jobId, value }) => ({ url: `/candidate/insights/feedback/${jobId}`, method: 'PUT', body: { value } }), invalidatesTags: ['Insights'] }),
    // M-064 "I have this skill" and its undo
    addProfileSkill: build.mutation({ query: (skill) => ({ url: '/candidate/profile/skills', method: 'POST', body: { skill } }), invalidatesTags: ['Insights', 'Profile', 'Me', 'Jobs'] }),
    removeProfileSkill: build.mutation({ query: (skill) => ({ url: `/candidate/profile/skills/${encodeURIComponent(skill)}`, method: 'DELETE' }), invalidatesTags: ['Insights', 'Profile', 'Me', 'Jobs'] }),
    // P9-Q2: the learning plan; its skills also rank Learning's suggestions
    addPlanSkill: build.mutation({ query: (skill) => ({ url: `/candidate/learning-plan/${encodeURIComponent(skill)}`, method: 'PUT' }), invalidatesTags: ['Insights', 'Courses'] }),
    removePlanSkill: build.mutation({ query: (skill) => ({ url: `/candidate/learning-plan/${encodeURIComponent(skill)}`, method: 'DELETE' }), invalidatesTags: ['Insights', 'Courses'] }),
    // M-062: the recruiter-ready profile summary
    writeProfileSummary: build.mutation({ query: () => ({ url: '/candidate/profile/ai-summary', method: 'POST' }) }),
    // M-058, M-059: a job's summary for a Plus candidate or an approved recruiter
    writeJobSummary: build.mutation({ query: (jobId) => ({ url: `/jobs/${jobId}/ai-summary`, method: 'POST' }) }),
    // M-057, C6: the recruiter's Match insights narrative, never with a score
    getRecruiterMatch: build.query({ query: ({ candidateId, jobId }) => ({ url: `/recruiter/candidates/${candidateId}/match`, params: { jobId } }) }),
    // M-144: user texts in the reader's language
    translate: build.mutation({ query: (body) => ({ url: '/translate', method: 'POST', body }) }),
  }),
})

export const {
  useGetInsightsOverviewQuery,
  useGetInsightRolesQuery,
  useGetInsightPageQuery,
  useGetInsightNarrativeQuery,
  useSaveExplanationFeedbackMutation,
  useAddProfileSkillMutation,
  useRemoveProfileSkillMutation,
  useAddPlanSkillMutation,
  useRemovePlanSkillMutation,
  useWriteProfileSummaryMutation,
  useWriteJobSummaryMutation,
  useGetRecruiterMatchQuery,
  useTranslateMutation,
} = aiApi
