import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'clients', lazy: lazyPage(() => import('./pages/ClientsPage.jsx')) }]
