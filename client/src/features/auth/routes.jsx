import { redirect } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'
import { landingPath, loadMe, requiredPage, SIGN_IN_PATH, WORKSPACE_PATH } from '@/app/session.js'

/** The sign-in page for one workspace, loaded on demand (kept out of the landing page's first download). */
const signIn = (workspace) => async () => {
  const { default: SignInPage } = await import('./pages/SignInPage.jsx')
  return { element: <SignInPage workspace={workspace} /> }
}

/** M-011: a signed-in visitor on a sign-in or sign-up page goes to their own landing page. */
async function redirectSignedIn({ request }) {
  const me = await loadMe()
  return me ? redirect(landingPath(me, new URL(request.url).searchParams.get('next'))) : null
}

/**
 * M-151, U37: onboarding needs a session of its workspace's role (recruiter, or agency since 2026-11-20); before the
 * email code only that step opens; approved → workspace.
 */
const onboardingLoader = (role) => async ({ request }) => {
  const { pathname } = new URL(request.url)
  const me = await loadMe()
  if (!me) return redirect(`${SIGN_IN_PATH[role]}?next=${encodeURIComponent(pathname)}`)
  if (me.role !== role) return redirect(landingPath(me))
  const required = requiredPage(me)
  if (!required) return redirect(WORKSPACE_PATH[role])
  return pathname.startsWith(required.prefix) ? null : redirect(required.path)
}

/** The email-code step and the onboarding steps of one hiring workspace. */
const onboardingRoutes = (role) => [
  {
    path: `${WORKSPACE_PATH[role]}/onboarding/email-code`,
    loader: onboardingLoader(role),
    lazy: lazyPage(() => import('./pages/EmailCodePage.jsx')),
    handle: { titleKey: 'titles.emailCode' },
  },
  {
    // The layout redirects to the first step that is still open.
    path: `${WORKSPACE_PATH[role]}/onboarding`,
    loader: onboardingLoader(role),
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

/** The recruiter sign-up page, also the agency one (2026-11-20). */
const signUp = (role) => async () => {
  const { default: RecruiterSignUpPage } = await import('./pages/RecruiterSignUpPage.jsx')
  return { element: <RecruiterSignUpPage role={role} /> }
}

/**
 * Public (unauthenticated) routes. Absolute paths; they take precedence over each
 * workspace's catch-all route.
 */
export default [
  { path: '/sign-in', loader: redirectSignedIn, lazy: signIn('candidate'), handle: { titleKey: 'titles.signIn' } },
  { path: '/sign-up', loader: redirectSignedIn, lazy: lazyPage(() => import('./pages/SignUpPage.jsx')), handle: { titleKey: 'titles.signUp' } },
  { path: '/recruiter/sign-in', loader: redirectSignedIn, lazy: signIn('recruiter'), handle: { titleKey: 'titles.signIn' } },
  { path: '/recruiter/sign-up', loader: redirectSignedIn, lazy: signUp('recruiter'), handle: { titleKey: 'titles.signUp' } },
  // 2026-11-20: the agency portal
  { path: '/agencies/login', loader: redirectSignedIn, lazy: signIn('agency'), handle: { titleKey: 'titles.signIn' } },
  { path: '/agencies/signup', loader: redirectSignedIn, lazy: signUp('agency'), handle: { titleKey: 'titles.signUp' } },
  { path: '/admin/sign-in', loader: redirectSignedIn, lazy: signIn('admin'), handle: { titleKey: 'titles.adminSignIn' } },
  { path: '/sign-up/check-email', lazy: lazyPage(() => import('./pages/CheckEmailPage.jsx')), handle: { titleKey: 'titles.checkEmail' } },
  { path: '/verify-email', lazy: lazyPage(() => import('./pages/VerifyEmailPage.jsx')), handle: { titleKey: 'titles.verifyEmail' } },
  { path: '/forgot-password', lazy: lazyPage(() => import('./pages/ForgotPasswordPage.jsx')), handle: { titleKey: 'titles.forgotPassword' } },
  { path: '/reset-password', lazy: lazyPage(() => import('./pages/ResetPasswordPage.jsx')), handle: { titleKey: 'titles.resetPassword' } },
  // U21: the admin invite link; before the admin workspace's catch-all.
  { path: '/admin/set-password', lazy: lazyPage(() => import('./pages/SetPasswordPage.jsx')), handle: { titleKey: 'titles.setPassword' } },
  ...onboardingRoutes('recruiter'),
  ...onboardingRoutes('agency'),
]
