import { lazyPage } from '@/app/lazyPage.js'

/** Public pages outside the auth flows (absolute paths): the legal texts (M-191). */
export default [{ path: '/legal/:doc', lazy: lazyPage(() => import('./pages/LegalPage.jsx')) }]
