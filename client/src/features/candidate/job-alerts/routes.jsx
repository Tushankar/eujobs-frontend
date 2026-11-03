import { lazyPage } from '@/app/lazyPage.js'

// Job alerts need `job_alerts` (M-118); the page itself shows the gate, so lapsed alerts stay readable (M-119, P7-Q2).
export default [{ path: 'job-alerts', lazy: lazyPage(() => import('./pages/JobAlertsPage.jsx')) }]
