import { lazyPage } from '@/app/lazyPage.js'

/* 2026-11-20: Admin › Agencies, as Recruiters; "Manage" opens the detail page. */
export default [
  { path: 'agencies', lazy: lazyPage(() => import('./pages/AgenciesPage.jsx')) },
  { path: 'agencies/:userId', lazy: lazyPage(() => import('./pages/AgencyDetailPage.jsx')), handle: { titleKey: 'nav.agencies' } },
]
