import { api } from '@/app/api.js'

/* FAQs for the signed-in role in the UI language (M-200). */
export const helpApi = api.injectEndpoints({
  endpoints: (build) => ({
    getFaqs: build.query({ query: (language) => `/help/faqs?language=${language}`, transformResponse: (response) => response.items, providesTags: ['Faqs'] }),
  }),
})

export const { useGetFaqsQuery } = helpApi
