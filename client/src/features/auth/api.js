import { api, writesMe } from '@/app/api.js'

/* Auth endpoints (§5 "Auth and me"). */
const post = (url) => (body) => ({ url, method: 'POST', body })

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
} = authApi
