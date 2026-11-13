import { api } from '@/app/api.js'

/* Admin > Payments (M-122, M-123, P10-Q5 … Q7): every payment row, its details and the all-time cards; the plans (2026-11-13). */
export const adminPaymentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminPayments: build.query({ query: (params) => ({ url: '/admin/payments', params }), providesTags: ['AdminPayments'] }),
    getAdminPayment: build.query({ query: (id) => `/admin/payments/${id}`, providesTags: ['AdminPayments'] }),
    getPaymentStats: build.query({ query: (params) => ({ url: '/admin/payments/stats', params }), providesTags: ['AdminPayments'] }),
    getAdminPlans: build.query({ query: () => '/admin/payments/plans', transformResponse: (response) => response.items, providesTags: ['AdminPlans'] }),
    // A saved plan changes the public and in-app plan cards too.
    updatePlan: build.mutation({ query: ({ key, ...body }) => ({ url: `/admin/payments/plans/${key}`, method: 'PATCH', body }), invalidatesTags: ['AdminPlans', 'Plans'] }),
  }),
})

export const { useGetAdminPaymentsQuery, useGetAdminPaymentQuery, useGetPaymentStatsQuery, useGetAdminPlansQuery, useUpdatePlanMutation } = adminPaymentsApi
