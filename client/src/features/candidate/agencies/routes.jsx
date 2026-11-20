import { lazyPage } from '@/app/lazyPage.js'

// 2026-11-20 (agencies, phase 5): Agencies (placements, offers, my agencies) and an agency's agreement to agree to.
export default [
  { path: 'agencies', lazy: lazyPage(() => import('./pages/AgenciesPage.jsx')) },
  { path: 'agencies/memberships/:membershipId/agreement', lazy: lazyPage(() => import('./pages/AgreementPage.jsx')) },
]
