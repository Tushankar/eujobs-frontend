import { lazyPage } from '@/app/lazyPage.js'

// One page for the three paths (pageKey, perf 2026-11-24): switching view doesn't remount it.
// "Manage stages" is a dialog over the board; its own path opens it directly. Board and Funnel view each have a URL.
export default [
  { path: 'hiring-pipeline', lazy: lazyPage(() => import('./pages/HiringPipelinePage.jsx')), handle: { pageKey: 'hiring-pipeline' } },
  { path: 'hiring-pipeline/funnel', lazy: lazyPage(() => import('./pages/HiringPipelinePage.jsx')), handle: { pageKey: 'hiring-pipeline' } },
  { path: 'hiring-pipeline/manage-stage', lazy: lazyPage(() => import('./pages/HiringPipelinePage.jsx')), handle: { pageKey: 'hiring-pipeline' } },
]
