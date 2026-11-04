import { api } from '@/app/api.js'

/* "Report" on jobs, companies, candidate profiles and messages (M-164, U20). */
export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    reportContent: build.mutation({ query: (body) => ({ url: '/reports', method: 'POST', body }) }),
  }),
})

export const { useReportContentMutation } = reportsApi
