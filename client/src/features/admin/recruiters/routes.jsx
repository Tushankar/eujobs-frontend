import { lazyPage } from '@/app/lazyPage.js'

/* M-161: "Manage" opens the detail page. */
export default [
  { path: 'recruiters', lazy: lazyPage(() => import('./pages/RecruitersPage.jsx')) },
  { path: 'recruiters/:userId', lazy: lazyPage(() => import('./pages/RecruiterDetailPage.jsx')), handle: { titleKey: 'nav.recruiters' } },
]
