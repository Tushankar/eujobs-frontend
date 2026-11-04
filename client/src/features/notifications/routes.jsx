import { lazyPage } from '@/app/lazyPage.js'

/** Shared Notifications page (P11b-Q2): mounted in the candidate, recruiter and admin workspaces. */
export default [{ path: 'notifications', lazy: lazyPage(() => import('./pages/NotificationsPage.jsx')), handle: { titleKey: 'titles.notifications' } }]
