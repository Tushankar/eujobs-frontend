import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'analytics', lazy: lazyPage(() => import('./pages/AnalyticsPage.jsx')) }]
