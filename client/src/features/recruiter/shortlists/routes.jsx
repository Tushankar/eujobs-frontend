import { lazyPage } from '@/app/lazyPage.js'

// §3.22, P11c-Q10: Shortlists need Recruiter Plus (`discovery`); RequirePlan shows the upgrade gate otherwise.
export default [
  {
    path: 'shortlists',
    lazy: lazyPage(() => import('@/features/candidate/billing/components/RequirePlan.jsx')),
    handle: { entitlement: 'discovery' },
    children: [{ index: true, lazy: lazyPage(() => import('./pages/ShortlistsPage.jsx')) }],
  },
]
