import { api } from '@/app/api.js'

/* Admin > Candidates and Recruiters (M-161, M-206): one server-paginated table per role and the detail pages. */
export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminUsers: build.query({ query: (params) => ({ url: '/admin/users', params }), providesTags: ['AdminUsers'] }),
    getAdminUser: build.query({ query: (id) => `/admin/users/${id}`, providesTags: ['AdminUsers'] }),
  }),
})

export const { useGetAdminUsersQuery, useGetAdminUserQuery } = usersApi
