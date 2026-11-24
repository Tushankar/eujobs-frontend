import { api, formData } from '@/app/api.js'

/* Admin › Website (2026-11-13): blog posts (`content.view` / `content.manage`), newsletter subscribers and job sectors (2026-11-24). */
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
    // 2026-11-24: job sectors; a change also refreshes every sector picker and name (`Sectors`).
    getAdminSectors: build.query({ query: () => '/admin/content/sectors', providesTags: ['AdminSectors'] }),
    createSector: build.mutation({ query: (body) => ({ url: '/admin/content/sectors', method: 'POST', body }), invalidatesTags: ['AdminSectors', 'Sectors'] }),
    updateSector: build.mutation({
      query: ({ key, ...body }) => ({ url: `/admin/content/sectors/${key}`, method: 'PATCH', body }),
      invalidatesTags: ['AdminSectors', 'Sectors'],
    }),
    // 2026-11-24: the sector sites; a change also refreshes the domain's own site answer (GET /meta/site).
    getAdminSites: build.query({ query: () => '/admin/content/sites', providesTags: ['AdminSites'] }),
    createSite: build.mutation({ query: (body) => ({ url: '/admin/content/sites', method: 'POST', body }), invalidatesTags: ['AdminSites'] }),
    updateSite: build.mutation({ query: ({ host, ...body }) => ({ url: `/admin/content/sites/${host}`, method: 'PATCH', body }), invalidatesTags: ['AdminSites'] }),
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
    sendNewsletterToNew: build.mutation({
      query: (id) => ({ url: `/admin/content/newsletter/${id}/send-new`, method: 'POST' }),
      invalidatesTags: ['NewsletterIssues'],
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
  useGetAdminSectorsQuery,
  useCreateSectorMutation,
  useUpdateSectorMutation,
  useGetAdminSitesQuery,
  useCreateSiteMutation,
  useUpdateSiteMutation,
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
  useSendNewsletterToNewMutation,
} = websiteApi
