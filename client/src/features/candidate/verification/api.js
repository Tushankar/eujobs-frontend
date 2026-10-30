import { api, formData } from '@/app/api.js'

/* Phone code and evidence (M-003, M-004, M-166). Changes answer with the verification state. */
const writesState = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(api.util.upsertQueryData('getVerification', undefined, data))
    } catch {
      // The caller shows the error.
    }
  },
  invalidatesTags: ['Me'],
}

export const verificationApi = api.injectEndpoints({
  endpoints: (build) => ({
    getVerification: build.query({ query: () => '/candidate/verification', providesTags: ['Verification'] }),
    // Answers with the code to show on screen; a changed number is unverified until confirmed.
    requestPhoneCode: build.mutation({
      query: (body) => ({ url: '/candidate/verification/phone/code', method: 'POST', body }),
      invalidatesTags: ['Me', 'Verification'],
    }),
    confirmPhone: build.mutation({ query: (code) => ({ url: '/candidate/verification/phone/confirm', method: 'POST', body: { code } }), ...writesState }),
    // Certificates are verified from their own file, so they send no file (M-025).
    submitEvidence: build.mutation({
      query: ({ file, ...fields }) => ({ url: '/candidate/verification/submissions', method: 'POST', body: file ? formData(file, fields) : fields }),
      ...writesState,
    }),
  }),
})

export const { useGetVerificationQuery, useRequestPhoneCodeMutation, useConfirmPhoneMutation, useSubmitEvidenceMutation } = verificationApi
