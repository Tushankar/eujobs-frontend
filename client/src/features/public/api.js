import { api, writesMe } from '@/app/api.js'

/* Legal texts (M-191, OD12) and their acceptance (U22); the public landing page's live data. */
export const publicApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLegal: build.query({ query: ({ doc, language }) => `/legal/${doc}?language=${language}`, providesTags: ['Legal'] }),
    getLanding: build.query({ query: (language) => `/landing?language=${language}` }),
    acceptLegal: build.mutation({ query: () => ({ url: '/me/legal/accept', method: 'POST' }), ...writesMe }),
  }),
})

export const { useGetLegalQuery, useGetLandingQuery, useAcceptLegalMutation } = publicApi
