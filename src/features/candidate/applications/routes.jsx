import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'applications', lazy: lazyPage(() => import('./pages/ApplicationsPage.jsx')) }]
