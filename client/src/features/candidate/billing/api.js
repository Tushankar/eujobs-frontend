import { api } from '@/app/api.js'

/* The plans (§3.3, §3.22): plan cards, the subscription for Billing (C14) and the Stripe Customer Portal (M-121). */
export const billingApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Candidates: prices in `currency` (the header country's, M-130); recruiters omit it (the company country's). Free is 0.
    getPlans: build.query({ query: (currency) => ({ url: '/plans', params: currency ? { currency } : {} }), transformResponse: (response) => response.items, providesTags: ['Plans'] }),
    // `role` = the signed-in user's role: /candidate/subscription or /recruiter/subscription.
    getSubscription: build.query({ query: (role) => `/${role}/subscription`, transformResponse: (response) => response.subscription, providesTags: ['Subscription'] }),
    createPortalSession: build.mutation({ query: () => ({ url: '/payments/portal-session', method: 'POST' }) }),
  }),
})

export const { useGetPlansQuery, useGetSubscriptionQuery, useCreatePortalSessionMutation } = billingApi
