import { api } from '@/app/api.js'

/* Admin › Applications (M-206, P10-Q14): every application, server-paginated, with status, country and search. */
export const adminApplicationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminApplications: build.query({ query: (params) => ({ url: '/admin/applications', params }), providesTags: ['AdminApplications'] }),
  }),
})

export const { useGetAdminApplicationsQuery } = adminApplicationsApi
