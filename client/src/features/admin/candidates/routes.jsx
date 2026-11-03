import { lazyPage } from '@/app/lazyPage.js'

/* M-161: "Manage" opens the detail page. */
export default [
  { path: 'candidates', lazy: lazyPage(() => import('./pages/CandidatesPage.jsx')) },
  { path: 'candidates/:userId', lazy: lazyPage(() => import('./pages/CandidateDetailPage.jsx')), handle: { titleKey: 'nav.candidates' } },
]
