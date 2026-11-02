import { api } from '@/app/api.js'

/* Payments shared by candidates and recruiters (M-122, M-124, M-125): quote, hosted Checkout, own payment rows. */
export const paymentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // The confirm step shows the server's item, price and currency (M-124).
    getQuote: build.query({ query: (params) => ({ url: '/payments/quote', params }) }),
    createCheckoutSession: build.mutation({ query: (body) => ({ url: '/payments/checkout-sessions', method: 'POST', body }) }),
    getCheckoutSession: build.query({ query: (id) => `/payments/checkout-sessions/${id}` }),
    getMyPayments: build.query({ query: () => '/me/payments', transformResponse: (response) => response.items, providesTags: ['Payments'] }),
  }),
})

export const { useGetQuoteQuery, useCreateCheckoutSessionMutation, useGetCheckoutSessionQuery, useGetMyPaymentsQuery } = paymentsApi
