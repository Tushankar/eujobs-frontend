import { api, formData } from '@/app/api.js'

/* CV versions (M-027 … M-031). Every change answers with the version list; the live CV is a checklist item. */
const writesVersions = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(api.util.upsertQueryData('getCvVersions', undefined, data))
    } catch {
      // The caller shows the error.
    }
  },
  invalidatesTags: ['Me', 'Profile'],
}

export const cvApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCvVersions: build.query({ query: () => '/candidate/cv', providesTags: ['Cv'] }),
    uploadCv: build.mutation({ query: (file) => ({ url: '/candidate/cv/versions', method: 'POST', body: formData(file) }), ...writesVersions }),
    setLiveCv: build.mutation({ query: (id) => ({ url: `/candidate/cv/versions/${id}/live`, method: 'POST' }), ...writesVersions }),
    deleteCv: build.mutation({ query: (id) => ({ url: `/candidate/cv/versions/${id}`, method: 'DELETE' }), ...writesVersions }),
    // M-027, M-061 (Plus): an AI snapshot proposal, its confirmation (P9-Q3: the profile changes) and assisted drafts
    proposeSnapshot: build.mutation({ query: (id) => ({ url: `/candidate/cv/versions/${id}/snapshot`, method: 'POST' }), ...writesVersions }),
    confirmSnapshot: build.mutation({ query: (id) => ({ url: `/candidate/cv/versions/${id}/snapshot/confirm`, method: 'POST' }), ...writesVersions, invalidatesTags: ['Me', 'Profile', 'Insights', 'Jobs'] }),
    createDraft: build.mutation({ query: (versionId) => ({ url: '/candidate/cv/drafts', method: 'POST', body: { versionId } }), ...writesVersions }),
    deleteDraft: build.mutation({ query: (id) => ({ url: `/candidate/cv/drafts/${id}`, method: 'DELETE' }), ...writesVersions }),
    // A fresh signed URL for each download (U39)
    getCvDownloadUrl: build.mutation({ query: (id) => `/candidate/cv/versions/${id}/download` }),
    // Earlier-version requests from companies and the download log (M-029, M-187, P4-D12)
    getCvRequests: build.query({ query: () => '/candidate/cv/requests', providesTags: ['CvRequests'] }),
    decideCvRequest: build.mutation({
      query: ({ id, ...body }) => ({ url: `/candidate/cv/requests/${id}/decision`, method: 'POST', body }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(api.util.upsertQueryData('getCvRequests', undefined, data))
        } catch {
          // The caller shows the error.
        }
      },
    }),
    getCvDownloads: build.query({ query: () => '/candidate/cv/downloads', providesTags: ['CvRequests'] }),
  }),
})

export const {
  useGetCvVersionsQuery,
  useUploadCvMutation,
  useSetLiveCvMutation,
  useDeleteCvMutation,
  useGetCvDownloadUrlMutation,
  useProposeSnapshotMutation,
  useConfirmSnapshotMutation,
  useCreateDraftMutation,
  useDeleteDraftMutation,
  useGetCvRequestsQuery,
  useDecideCvRequestMutation,
  useGetCvDownloadsQuery,
} = cvApi
