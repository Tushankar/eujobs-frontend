import { lazyPage } from '@/app/lazyPage.js'

// P11b-Q9: /applications/:applicationId opens that application's activity dialog.
export default [{ path: 'applications/:applicationId?', lazy: lazyPage(() => import('./pages/ApplicationsPage.jsx')) }]
