import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'reports', lazy: lazyPage(() => import('./pages/ReportsPage.jsx')) }]
