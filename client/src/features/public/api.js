import { api, writesMe } from '@/app/api.js'

/*
 * Legal texts (M-191, OD12) and their acceptance (U22); the public landing page's live data; the public blog, pricing
 * and newsletter double opt-in (2026-11-13).
 */
export const publicApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLegal: build.query({ query: ({ doc, language }) => `/legal/${doc}?language=${language}`, providesTags: ['Legal'] }),
    getLanding: build.query({ query: (language) => `/landing?language=${language}` }),
    acceptLegal: build.mutation({ query: () => ({ url: '/me/legal/accept', method: 'POST' }), ...writesMe }),
    getBlogPosts: build.query({ query: ({ language, page }) => ({ url: '/blog', params: { language, page } }) }),
    getBlogPost: build.query({ query: (slug) => `/blog/${slug}` }),
    getPublicPlans: build.query({
      query: ({ role, language }) => ({ url: '/plans', params: { role, language } }),
      transformResponse: (response) => response.items,
    }),
    subscribeNewsletter: build.mutation({ query: (body) => ({ url: '/newsletter', method: 'POST', body }) }),
    confirmNewsletter: build.mutation({ query: (token) => ({ url: '/newsletter/confirm', method: 'POST', body: { token } }) }),
    unsubscribeNewsletter: build.mutation({ query: (token) => ({ url: '/newsletter/unsubscribe', method: 'POST', body: { token } }) }),
  }),
})

export const {
  useGetLegalQuery,
  useGetLandingQuery,
  useAcceptLegalMutation,
  useGetBlogPostsQuery,
  useGetBlogPostQuery,
  useGetPublicPlansQuery,
  useSubscribeNewsletterMutation,
  useConfirmNewsletterMutation,
  useUnsubscribeNewsletterMutation,
} = publicApi
