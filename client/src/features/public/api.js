import { api, writesMe } from '@/app/api.js'

/* Legal texts (M-191, OD12) and their acceptance (U22). */
export const publicApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLegal: build.query({ query: ({ doc, language }) => `/legal/${doc}?language=${language}`, providesTags: ['Legal'] }),
    acceptLegal: build.mutation({ query: () => ({ url: '/me/legal/accept', method: 'POST' }), ...writesMe }),
  }),
})

export const { useGetLegalQuery, useAcceptLegalMutation } = publicApi
