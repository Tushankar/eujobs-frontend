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
    // A fresh signed URL for each download (U39)
    getCvDownloadUrl: build.mutation({ query: (id) => `/candidate/cv/versions/${id}/download` }),
  }),
})

export const { useGetCvVersionsQuery, useUploadCvMutation, useSetLiveCvMutation, useDeleteCvMutation, useGetCvDownloadUrlMutation } = cvApi
