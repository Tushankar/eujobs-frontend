import { api } from '@/app/api.js'

/*
 * Job alerts (§3.6): the list (readable after a lapse, with `planPaused`, M-119, P7-Q2), create, edit, pause and
 * resume (PATCH `active`) and delete. The country is the header country when the alert is created (U35).
 */
export const jobAlertsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getJobAlerts: build.query({ query: () => '/candidate/job-alerts', providesTags: ['JobAlerts'] }),
    createJobAlert: build.mutation({ query: (body) => ({ url: '/candidate/job-alerts', method: 'POST', body }), invalidatesTags: ['JobAlerts'] }),
    updateJobAlert: build.mutation({ query: ({ id, ...body }) => ({ url: `/candidate/job-alerts/${id}`, method: 'PATCH', body }), invalidatesTags: ['JobAlerts'] }),
    deleteJobAlert: build.mutation({ query: (id) => ({ url: `/candidate/job-alerts/${id}`, method: 'DELETE' }), invalidatesTags: ['JobAlerts'] }),
  }),
})

export const { useGetJobAlertsQuery, useCreateJobAlertMutation, useUpdateJobAlertMutation, useDeleteJobAlertMutation } = jobAlertsApi
