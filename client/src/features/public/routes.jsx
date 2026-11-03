import { lazyPage } from '@/app/lazyPage.js'

/** Public pages outside the auth flows (absolute paths): the legal texts (M-191) and the certificate check (M-105). */
export default [
  { path: '/legal/:doc', lazy: lazyPage(() => import('./pages/LegalPage.jsx')) },
  { path: '/certificates/:code', lazy: lazyPage(() => import('./pages/CertificatePage.jsx')) },
]
