import { lazyPage } from '@/app/lazyPage.js'

/** Shared Help page: mounted in the candidate, recruiter and admin workspaces. */
export default [{ path: 'help', lazy: lazyPage(() => import('./pages/HelpPage.jsx')), handle: { title: 'Help' } }]
