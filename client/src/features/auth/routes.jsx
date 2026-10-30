import { redirect } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'
import { landingPath, loadMe, requiredPage } from '@/app/session.js'
import SignInPage from './pages/SignInPage.jsx'

/** M-011: a signed-in visitor on a sign-in or sign-up page goes to their own landing page. */
async function redirectSignedIn({ request }) {
  const me = await loadMe()
  return me ? redirect(landingPath(me, new URL(request.url).searchParams.get('next'))) : null
}

/** M-151, U37: onboarding needs a recruiter session; before the email code only that step opens; approved → workspace. */
async function onboardingLoader({ request }) {
  const { pathname } = new URL(request.url)
  const me = await loadMe()
  if (!me) return redirect(`/recruiter/sign-in?next=${encodeURIComponent(pathname)}`)
  if (me.role !== 'recruiter') return redirect(landingPath(me))
  const required = requiredPage(me)
  if (!required) return redirect('/recruiter')
  return pathname.startsWith(required.prefix) ? null : redirect(required.path)
}

/**
 * Public (unauthenticated) routes. Absolute paths; they take precedence over each
 * workspace's catch-all route.
 */
export default [
  { path: '/sign-in', loader: redirectSignedIn, element: <SignInPage workspace="candidate" />, handle: { titleKey: 'titles.signIn' } },
  { path: '/sign-up', loader: redirectSignedIn, lazy: lazyPage(() => import('./pages/SignUpPage.jsx')), handle: { titleKey: 'titles.signUp' } },
  { path: '/recruiter/sign-in', loader: redirectSignedIn, element: <SignInPage workspace="recruiter" />, handle: { titleKey: 'titles.signIn' } },
  {
    path: '/recruiter/sign-up',
    loader: redirectSignedIn,
    lazy: lazyPage(() => import('./pages/RecruiterSignUpPage.jsx')),
    handle: { titleKey: 'titles.signUp' },
  },
  { path: '/admin/sign-in', loader: redirectSignedIn, element: <SignInPage workspace="admin" />, handle: { titleKey: 'titles.adminSignIn' } },
  { path: '/sign-up/check-email', lazy: lazyPage(() => import('./pages/CheckEmailPage.jsx')), handle: { titleKey: 'titles.checkEmail' } },
  { path: '/verify-email', lazy: lazyPage(() => import('./pages/VerifyEmailPage.jsx')), handle: { titleKey: 'titles.verifyEmail' } },
  { path: '/forgot-password', lazy: lazyPage(() => import('./pages/ForgotPasswordPage.jsx')), handle: { titleKey: 'titles.forgotPassword' } },
  { path: '/reset-password', lazy: lazyPage(() => import('./pages/ResetPasswordPage.jsx')), handle: { titleKey: 'titles.resetPassword' } },
  {
    path: '/recruiter/onboarding/email-code',
    loader: onboardingLoader,
    lazy: lazyPage(() => import('./pages/EmailCodePage.jsx')),
    handle: { titleKey: 'titles.emailCode' },
  },
  {
    // Recruiter onboarding: the layout redirects to the first step that is still open (mock until Phase 4).
    path: '/recruiter/onboarding',
    loader: onboardingLoader,
    lazy: lazyPage(() => import('./components/OnboardingLayout.jsx')),
    children: [
      { path: 'account', lazy: lazyPage(() => import('./pages/AccountRegistrationPage.jsx')) },
      { path: 'company', lazy: lazyPage(() => import('./pages/CompanyInformationPage.jsx')) },
      { path: 'kyc', lazy: lazyPage(() => import('./pages/KycVerificationPage.jsx')) },
      { path: 'verify', lazy: lazyPage(() => import('./pages/VerifyAccountPage.jsx')) },
      { path: 'review', lazy: lazyPage(() => import('./pages/AdminReviewPage.jsx')) },
    ],
  },
]
