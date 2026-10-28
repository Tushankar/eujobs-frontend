import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'job-alerts', lazy: lazyPage(() => import('./pages/JobAlertsPage.jsx')) }]
