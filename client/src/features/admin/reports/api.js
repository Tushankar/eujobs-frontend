import { api, formData } from '@/app/api.js'

/* Admin › Reports (M-181 … M-183): the history and a new report (multipart, with the optional voice note). */
export const adminReportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getReports: build.query({ query: () => '/admin/reports', providesTags: ['AdminReports'] }),
    createReport: build.mutation({
      query: ({ voiceNote, ...fields }) => ({ url: '/admin/reports', method: 'POST', body: formData(voiceNote, fields) }),
      invalidatesTags: ['AdminReports', 'AuditEvents'],
    }),
  }),
})

export const { useGetReportsQuery, useCreateReportMutation } = adminReportsApi
