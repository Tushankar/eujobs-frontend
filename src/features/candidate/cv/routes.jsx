import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'cv-versions', lazy: lazyPage(() => import('./pages/CvVersionsPage.jsx')) }]
