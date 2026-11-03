import { api, formData, writesMe } from '@/app/api.js'

/* Auth endpoints (§5 "Auth and me") and recruiter onboarding (M-151 … M-153). */
const post = (url) => (body) => ({ url, method: 'POST', body })

/** Onboarding changes answer with the whole onboarding state, written into getOnboarding. */
const writesOnboarding = (tags = []) => ({
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(api.util.upsertQueryData('getOnboarding', undefined, data))
    } catch {
      // The caller shows the error.
    }
  },
  invalidatesTags: tags,
})

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({ query: post('/auth/login') }),
    registerCandidate: build.mutation({ query: post('/auth/candidate/register') }),
    registerRecruiter: build.mutation({ query: post('/auth/recruiter/register') }),
    verifyEmail: build.mutation({ query: (token) => post('/auth/verify-email')({ token }) }),
    resendVerifyEmail: build.mutation({ query: (email) => post('/auth/verify-email/resend')({ email }) }),
    verifyEmailCode: build.mutation({ query: (code) => post('/auth/email-code/verify')({ code }), ...writesMe }),
    resendEmailCode: build.mutation({ query: () => ({ url: '/auth/email-code/resend', method: 'POST' }) }),
    forgotPassword: build.mutation({ query: (email) => post('/auth/forgot-password')({ email }) }),
    resetPassword: build.mutation({ query: post('/auth/reset-password') }),
    // U21: an admin invite link (/admin/set-password)
    getInvite: build.query({ query: (token) => `/auth/invite/${encodeURIComponent(token)}` }),
    acceptInvite: build.mutation({ query: post('/auth/invite/accept') }),
    getOnboarding: build.query({ query: () => '/recruiter/onboarding', providesTags: ['Onboarding'] }),
    updateOnboardingAccount: build.mutation({ query: (body) => ({ url: '/recruiter/onboarding/account', method: 'PUT', body }), ...writesOnboarding(['Me']) }),
    // The company country becomes the header country (and the language unless chosen), so /me is refreshed by the page.
    saveOnboardingCompany: build.mutation({ query: (body) => ({ url: '/recruiter/onboarding/company', method: 'PUT', body }), ...writesOnboarding() }),
    uploadKycDocument: build.mutation({ query: ({ type, file }) => ({ url: '/recruiter/onboarding/documents', method: 'POST', body: formData(file, { type }) }), ...writesOnboarding() }),
    deleteKycDocument: build.mutation({ query: (id) => ({ url: `/recruiter/onboarding/documents/${id}`, method: 'DELETE' }), ...writesOnboarding() }),
    // Step 4 asks for the stored number, so the onboarding state does not change; refetching it here could land after
    // the confirm and bring back an unverified phone.
    requestOnboardingPhoneCode: build.mutation({ query: post('/recruiter/onboarding/phone/code') }),
    confirmOnboardingPhone: build.mutation({ query: (code) => post('/recruiter/onboarding/phone/confirm')({ code }), ...writesOnboarding(['Me']) }),
    submitOnboarding: build.mutation({ query: () => ({ url: '/recruiter/onboarding/submit', method: 'POST' }), ...writesOnboarding(['Me']) }),
  }),
})

export const {
  useLoginMutation,
  useRegisterCandidateMutation,
  useRegisterRecruiterMutation,
  useVerifyEmailMutation,
  useResendVerifyEmailMutation,
  useVerifyEmailCodeMutation,
  useResendEmailCodeMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetInviteQuery,
  useAcceptInviteMutation,
  useGetOnboardingQuery,
  useUpdateOnboardingAccountMutation,
  useSaveOnboardingCompanyMutation,
  useUploadKycDocumentMutation,
  useDeleteKycDocumentMutation,
  useRequestOnboardingPhoneCodeMutation,
  useConfirmOnboardingPhoneMutation,
  useSubmitOnboardingMutation,
} = authApi
