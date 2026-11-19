import { api, formData } from '@/app/api.js'

/* Admin › Website (2026-11-13): blog posts (`content.view` / `content.manage`) and newsletter subscribers. */
export const websiteApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminPosts: build.query({ query: () => '/admin/content/blog', providesTags: ['AdminBlog'] }),
    getAdminPost: build.query({ query: (id) => `/admin/content/blog/${id}`, providesTags: ['AdminBlog'] }),
    createPost: build.mutation({ query: (body) => ({ url: '/admin/content/blog', method: 'POST', body }), invalidatesTags: ['AdminBlog'] }),
    updatePost: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/content/blog/${id}`, method: 'PATCH', body }), invalidatesTags: ['AdminBlog'] }),
    setPostStatus: build.mutation({
      query: ({ id, status }) => ({ url: `/admin/content/blog/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['AdminBlog'],
    }),
    deletePost: build.mutation({ query: (id) => ({ url: `/admin/content/blog/${id}`, method: 'DELETE' }), invalidatesTags: ['AdminBlog'] }),
    uploadBlogCover: build.mutation({ query: (file) => ({ url: '/admin/content/blog/covers', method: 'POST', body: formData(file) }) }),
    getSubscribers: build.query({
      query: ({ status, page }) => ({ url: '/admin/content/subscribers', params: { status, page } }),
      providesTags: ['Subscribers'],
    }),
    // 2026-11-19: newsletter issues (jobs, posts and a per-language intro, sent to the confirmed subscribers).
    getNewsletterIssues: build.query({ query: () => '/admin/content/newsletter', providesTags: ['NewsletterIssues'] }),
    getNewsletterIssue: build.query({
      query: (id) => `/admin/content/newsletter/${id}`,
      providesTags: ['NewsletterIssues'],
    }),
    getNewsletterOptions: build.query({ query: () => '/admin/content/newsletter/options' }),
    getNewsletterPreview: build.query({
      query: ({ id, language }) => ({ url: `/admin/content/newsletter/${id}/preview`, params: { language } }),
      providesTags: ['NewsletterIssues'],
    }),
    createNewsletterIssue: build.mutation({ query: () => ({ url: '/admin/content/newsletter', method: 'POST' }), invalidatesTags: ['NewsletterIssues'] }),
    updateNewsletterIssue: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/content/newsletter/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['NewsletterIssues'],
    }),
    deleteNewsletterIssue: build.mutation({ query: (id) => ({ url: `/admin/content/newsletter/${id}`, method: 'DELETE' }), invalidatesTags: ['NewsletterIssues'] }),
    sendNewsletterTest: build.mutation({
      query: ({ id, language }) => ({ url: `/admin/content/newsletter/${id}/test`, method: 'POST', body: { language } }),
    }),
    sendNewsletterIssue: build.mutation({
      query: (id) => ({ url: `/admin/content/newsletter/${id}/send`, method: 'POST' }),
      invalidatesTags: ['NewsletterIssues', 'Subscribers'],
    }),
  }),
})

export const {
  useGetAdminPostsQuery,
  useGetAdminPostQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useSetPostStatusMutation,
  useDeletePostMutation,
  useUploadBlogCoverMutation,
  useGetSubscribersQuery,
  useGetNewsletterIssuesQuery,
  useGetNewsletterIssueQuery,
  useGetNewsletterOptionsQuery,
  useGetNewsletterPreviewQuery,
  useCreateNewsletterIssueMutation,
  useUpdateNewsletterIssueMutation,
  useDeleteNewsletterIssueMutation,
  useSendNewsletterTestMutation,
  useSendNewsletterIssueMutation,
} = websiteApi
