import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'placements', lazy: lazyPage(() => import('./pages/PlacementsPage.jsx')) }]
