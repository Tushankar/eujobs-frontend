import { api } from '@/app/api.js'

/* Candidate privacy flags (M-187). */
export const settingsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPrivacy: build.query({ query: () => '/candidate/settings/privacy', providesTags: ['Privacy'] }),
    updatePrivacy: build.mutation({
      query: (body) => ({ url: '/candidate/settings/privacy', method: 'PATCH', body }),
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        const patch = dispatch(settingsApi.util.updateQueryData('getPrivacy', undefined, (draft) => Object.assign(draft, body)))
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
  }),
})

export const { useGetPrivacyQuery, useUpdatePrivacyMutation } = settingsApi
