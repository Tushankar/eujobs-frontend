import { lazyPage } from '@/app/lazyPage.js'

/* The AI summary dialog is a route of its own: it renders the jobs list with the summary open. */
export default [
  { path: 'jobs', lazy: lazyPage(() => import('./pages/JobsPage.jsx')) },
  { path: 'jobs/:jobId/ai-summary', lazy: lazyPage(() => import('./pages/JobsPage.jsx')) },
]
