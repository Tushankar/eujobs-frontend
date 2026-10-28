import { lazyPage } from '@/app/lazyPage.js'

// "Manage stages" is a dialog over the board; its own path opens it directly.
export default [
  { path: 'hiring-pipeline', lazy: lazyPage(() => import('./pages/HiringPipelinePage.jsx')) },
  { path: 'hiring-pipeline/manage-stage', lazy: lazyPage(() => import('./pages/HiringPipelinePage.jsx')) },
]
