import { lazyPage } from '@/app/lazyPage.js'

// Job alerts need the `job_alerts` entitlement (M-118, M-119).
export default [
  {
    path: 'job-alerts',
    lazy: lazyPage(() => import('../billing/components/RequirePlan.jsx')),
    handle: { entitlement: 'job_alerts' },
    children: [{ index: true, lazy: lazyPage(() => import('./pages/JobAlertsPage.jsx')) }],
  },
]
