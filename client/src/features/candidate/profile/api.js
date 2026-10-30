import { api, formData } from '@/app/api.js'

/*
 * The candidate profile (§3.2). Every change answers with the full profile, which is written straight into
 * getProfile; /me (completeness, shell photo) and the verification page are refetched.
 */
export const writesProfile = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(api.util.upsertQueryData('getProfile', undefined, data))
    } catch {
      // A failed change leaves the profile as it was; the caller shows the error.
    }
  },
  invalidatesTags: ['Me', 'Verification'],
}

const change = (build, query) => build.mutation({ query, ...writesProfile })

export const profileApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProfile: build.query({ query: () => '/candidate/profile', providesTags: ['Profile'] }),
    getLanguageCodes: build.query({ query: () => '/meta/languages', transformResponse: (response) => response.items }),
    updateProfile: change(build, (body) => ({ url: '/candidate/profile', method: 'PUT', body })),
    // `kind` is "work-history" or "education"
    addEntry: change(build, ({ kind, body }) => ({ url: `/candidate/profile/${kind}`, method: 'POST', body })),
    updateEntry: change(build, ({ kind, id, body }) => ({ url: `/candidate/profile/${kind}/${id}`, method: 'PATCH', body })),
    deleteEntry: change(build, ({ kind, id }) => ({ url: `/candidate/profile/${kind}/${id}`, method: 'DELETE' })),
    setNone: change(build, ({ kind, none }) => ({ url: `/candidate/profile/${kind}/none`, method: 'PUT', body: { none } })),
    setLanguages: change(build, (languages) => ({ url: '/candidate/profile/languages', method: 'PUT', body: { languages } })),
    setRightToWork: change(build, (rightToWork) => ({ url: '/candidate/profile/right-to-work', method: 'PUT', body: { rightToWork } })),
    setLinks: change(build, (links) => ({ url: '/candidate/profile/links', method: 'PUT', body: links })),
    uploadPhoto: change(build, (file) => ({ url: '/candidate/profile/photo', method: 'POST', body: formData(file) })),
    removePhoto: change(build, () => ({ url: '/candidate/profile/photo', method: 'DELETE' })),
    addCertificate: change(build, (body) => ({ url: '/candidate/profile/certificates', method: 'POST', body })),
    updateCertificate: change(build, ({ id, body }) => ({ url: `/candidate/profile/certificates/${id}`, method: 'PATCH', body })),
    deleteCertificate: change(build, (id) => ({ url: `/candidate/profile/certificates/${id}`, method: 'DELETE' })),
    setCertificateFile: change(build, ({ id, file }) => ({ url: `/candidate/profile/certificates/${id}/file`, method: 'PUT', body: formData(file) })),
    removeCertificateFile: change(build, (id) => ({ url: `/candidate/profile/certificates/${id}/file`, method: 'DELETE' })),
  }),
})

export const {
  useGetProfileQuery,
  useGetLanguageCodesQuery,
  useUpdateProfileMutation,
  useAddEntryMutation,
  useUpdateEntryMutation,
  useDeleteEntryMutation,
  useSetNoneMutation,
  useSetLanguagesMutation,
  useSetRightToWorkMutation,
  useSetLinksMutation,
  useUploadPhotoMutation,
  useRemovePhotoMutation,
  useAddCertificateMutation,
  useUpdateCertificateMutation,
  useDeleteCertificateMutation,
  useSetCertificateFileMutation,
  useRemoveCertificateFileMutation,
} = profileApi
