import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'applications/:applicationId?', lazy: lazyPage(() => import('./pages/ApplicationsPage.jsx')) }]
