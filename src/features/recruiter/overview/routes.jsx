import { lazyPage } from '@/app/lazyPage.js'

export default [{ index: true, lazy: lazyPage(() => import('./pages/OverviewPage.jsx')) }]
