import { api } from '@/app/api.js'

/* The candidate plan (§3.3): plan cards, the subscription for Billing (C14) and the Stripe Customer Portal (M-121). */
export const billingApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Prices in `currency` (the header country's, M-130); Free is 0.
    getPlans: build.query({ query: (currency) => ({ url: '/plans', params: { currency } }), transformResponse: (response) => response.items, providesTags: ['Plans'] }),
    getSubscription: build.query({ query: () => '/candidate/subscription', transformResponse: (response) => response.subscription, providesTags: ['Subscription'] }),
    createPortalSession: build.mutation({ query: () => ({ url: '/payments/portal-session', method: 'POST' }) }),
  }),
})

export const { useGetPlansQuery, useGetSubscriptionQuery, useCreatePortalSessionMutation } = billingApi
