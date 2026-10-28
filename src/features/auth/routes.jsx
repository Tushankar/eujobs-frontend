import { lazyPage } from '@/app/lazyPage.js'
import SignInPage from './pages/SignInPage.jsx'

/**
 * Public (unauthenticated) routes. Absolute paths; they take precedence over each
 * workspace's catch-all route.
 */
export default [
  { path: '/sign-in', element: <SignInPage workspace="candidate" /> },
  { path: '/sign-up', lazy: lazyPage(() => import('./pages/SignUpPage.jsx')) },
  { path: '/recruiter/sign-in', element: <SignInPage workspace="recruiter" /> },
  { path: '/recruiter/sign-up', lazy: lazyPage(() => import('./pages/RecruiterSignUpPage.jsx')) },
  { path: '/admin/sign-in', element: <SignInPage workspace="admin" /> },
  {
    // Recruiter onboarding: the layout redirects to the first step that is still open.
    path: '/recruiter/onboarding',
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
