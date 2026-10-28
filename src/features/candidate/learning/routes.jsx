import { lazyPage } from '@/app/lazyPage.js'

export default [
  { path: 'learning', lazy: lazyPage(() => import('./pages/LearningPage.jsx')) },
  { path: 'learning/:courseId', lazy: lazyPage(() => import('./pages/LearningDetailsPage.jsx')) },
]
