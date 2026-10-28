import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'shortlists', lazy: lazyPage(() => import('./pages/ShortlistsPage.jsx')) }]
