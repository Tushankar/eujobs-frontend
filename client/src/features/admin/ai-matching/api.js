import { api } from '@/app/api.js'

/*
 * Admin > AI & matching (M-048, M-049, M-068): policies with their versions, the description suggestion (OpenAI),
 * the oversight of one job's top candidates and the AI service status. Policy changes recompute the scores on the
 * server, so the oversight refetches. Each write puts the answered policy into the cached list at once (the editor
 * shows a new policy before the list refetches); the refetch then brings the other policies' statuses.
 */
const writesPolicy = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(
        aiMatchingApi.util.updateQueryData('getPolicies', undefined, (list) => {
          const index = list.items.findIndex((item) => item.id === data.id)
          if (index === -1) list.items.push(data)
          else list.items[index] = data
        }),
      )
    } catch {
      // The caller shows the error; the cached list is unchanged.
    }
  },
  invalidatesTags: ['MatchingPolicies', 'Oversight'],
}

export const aiMatchingApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPolicies: build.query({ query: () => '/admin/matching/policies', providesTags: ['MatchingPolicies'] }),
    createPolicy: build.mutation({ query: (body) => ({ url: '/admin/matching/policies', method: 'POST', body }), ...writesPolicy }),
    updatePolicy: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/matching/policies/${id}`, method: 'PATCH', body }), ...writesPolicy }),
    savePolicySignals: build.mutation({ query: ({ id, signals }) => ({ url: `/admin/matching/policies/${id}/signals`, method: 'PUT', body: signals }), ...writesPolicy }),
    activatePolicy: build.mutation({ query: (id) => ({ url: `/admin/matching/policies/${id}/activate`, method: 'POST' }), ...writesPolicy }),
    archivePolicy: build.mutation({ query: (id) => ({ url: `/admin/matching/policies/${id}/archive`, method: 'POST' }), ...writesPolicy }),
    suggestPolicyDescription: build.mutation({ query: (body) => ({ url: '/admin/matching/policies/suggest', method: 'POST', body }) }),
    getOversight: build.query({ query: (params) => ({ url: '/admin/matching/oversight', params }), providesTags: ['Oversight'] }),
    getAiStatus: build.query({ query: () => '/admin/ai/status', providesTags: ['AiStatus'] }),
  }),
})

export const {
  useGetPoliciesQuery,
  useCreatePolicyMutation,
  useUpdatePolicyMutation,
  useSavePolicySignalsMutation,
  useActivatePolicyMutation,
  useArchivePolicyMutation,
  useSuggestPolicyDescriptionMutation,
  useGetOversightQuery,
  useGetAiStatusQuery,
} = aiMatchingApi
