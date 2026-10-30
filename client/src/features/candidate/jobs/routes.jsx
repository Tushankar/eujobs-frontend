import { lazyPage } from '@/app/lazyPage.js'

export default [
  { path: 'jobs', lazy: lazyPage(() => import('./pages/FindJobsPage.jsx')) },
  { path: 'jobs/:jobId', lazy: lazyPage(() => import('./pages/JobDetailsPage.jsx')) },
]
