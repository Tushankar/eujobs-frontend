import { api } from '@/app/api.js'

/* Admin > Payments (M-122, M-123, P10-Q5 … Q7): every payment row, its details and the all-time cards. */
export const adminPaymentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminPayments: build.query({ query: (params) => ({ url: '/admin/payments', params }), providesTags: ['AdminPayments'] }),
    getAdminPayment: build.query({ query: (id) => `/admin/payments/${id}`, providesTags: ['AdminPayments'] }),
    getPaymentStats: build.query({ query: (params) => ({ url: '/admin/payments/stats', params }), providesTags: ['AdminPayments'] }),
  }),
})

export const { useGetAdminPaymentsQuery, useGetAdminPaymentQuery, useGetPaymentStatsQuery } = adminPaymentsApi
