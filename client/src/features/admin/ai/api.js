import { api } from '@/app/api.js'

/*
 * Admin AI helpers (owner 2026-11-17, phase 4): suggestions only, never saved by the server; the admin edits and saves
 * through the usual forms and actions. Admins are never counted toward AI credits.
 */
export const adminAiApi = api.injectEndpoints({
  endpoints: (build) => ({
    draftCourseDetails: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/ai-drafts/courses/${id}/details`, method: 'POST', body }) }),
    suggestQuizQuestions: build.mutation({ query: ({ id, count }) => ({ url: `/admin/ai-drafts/courses/${id}/quiz-questions`, method: 'POST', body: { count } }) }),
    triageReport: build.mutation({ query: (id) => ({ url: `/admin/ai-drafts/moderation/cases/${id}/triage`, method: 'POST' }) }),
    summariseAccount: build.mutation({ query: (userId) => ({ url: `/admin/ai-drafts/moderation/accounts/${userId}/summary`, method: 'POST' }) }),
    draftBlogPost: build.mutation({ query: (body) => ({ url: '/admin/ai-drafts/blog-draft', method: 'POST', body }) }),
  }),
})

export const { useDraftCourseDetailsMutation, useSuggestQuizQuestionsMutation, useTriageReportMutation, useSummariseAccountMutation, useDraftBlogPostMutation } = adminAiApi
