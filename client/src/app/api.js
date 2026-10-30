import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getToken } from './token.js'

/*
 * One RTK Query API (§2.15). Feature groups add endpoints with api.injectEndpoints in their own
 * api.js. Errors arrive as { status, data: { error: { code, fields, params } } } (§2.3).
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL ?? ''}/api/v1`,
  prepareHeaders(headers) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Set by app/session.js, which owns sign-out (it imports this module, so it registers itself).
let onAuthRequired = () => {}
export function setAuthRequiredHandler(handler) {
  onAuthRequired = handler
}

/** M-011: an expired or revoked session clears the token and returns to sign-in with ?next. */
async function baseQueryWithReauth(args, queryApi, extraOptions) {
  const result = await rawBaseQuery(args, queryApi, extraOptions)
  if (result.error?.data?.error?.code === 'AUTH_REQUIRED' && getToken()) onAuthRequired(queryApi.dispatch)
  return result
}

/** For mutations that answer with the new /me: write it straight into the getMe cache. */
export const writesMe = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(api.util.upsertQueryData('getMe', undefined, data))
    } catch {
      // A failed mutation leaves /me as it was; the caller shows the error.
    }
  },
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Countries', 'Config', 'Faqs', 'Legal', 'Profile', 'Cv', 'Verification', 'Privacy', 'VerificationQueue'],
  endpoints: (build) => ({
    getMe: build.query({ query: () => '/me', providesTags: ['Me'] }),
    updateMe: build.mutation({ query: (body) => ({ url: '/me', method: 'PATCH', body }), ...writesMe }),
    getConfig: build.query({ query: () => '/meta/config', providesTags: ['Config'] }),
    getCountries: build.query({ query: () => '/meta/countries', transformResponse: (response) => response.items, providesTags: ['Countries'] }),
    // City fields of every role (G-1, §2.16): the server proxies Google in the user's language.
    getPlaceSuggestions: build.query({
      query: ({ input, sessionToken }) => ({ url: '/places/autocomplete', params: { input, sessionToken } }),
      transformResponse: (response) => response.items,
    }),
    getPlace: build.query({ query: ({ placeId, sessionToken }) => ({ url: `/places/${placeId}`, params: { sessionToken } }) }),
  }),
})

export const { useGetMeQuery, useUpdateMeMutation, useGetConfigQuery, useGetCountriesQuery, useGetPlaceSuggestionsQuery, useLazyGetPlaceQuery } = api

/** A multipart body (§2.6): the file under `file`, plus text fields; empty fields are left out. */
export function formData(file, fields = {}) {
  const body = new FormData()
  for (const [name, value] of Object.entries(fields)) if (value != null && value !== '') body.append(name, value)
  if (file) body.append('file', file)
  return body
}

/** The API error code of a failed request, or NETWORK_ERROR when the server could not be reached. */
export function errorCode(error) {
  return error?.data?.error?.code ?? 'NETWORK_ERROR'
}
