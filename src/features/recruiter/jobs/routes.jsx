import { lazyPage } from '@/app/lazyPage.js'

// Job details has no title of its own: the breadcrumb falls back to "Jobs", as in the Figma frame.
export default [
  { path: 'jobs', lazy: lazyPage(() => import('./pages/JobsPage.jsx')) },
  { path: 'jobs/new', lazy: lazyPage(() => import('./pages/CreateJobPage.jsx')), handle: { title: 'Create Job' } },
  { path: 'jobs/:jobId', lazy: lazyPage(() => import('./pages/JobDetailsPage.jsx')) },
  {
    path: 'jobs/:jobId/edit',
    lazy: lazyPage(() => import('./pages/CreateJobPage.jsx')),
    handle: { title: 'Edit Job' },
  },
]
