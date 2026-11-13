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
} = websiteApi
