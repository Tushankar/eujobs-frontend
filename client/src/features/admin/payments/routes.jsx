import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'payments', lazy: lazyPage(() => import('./pages/PaymentsPage.jsx')), handle: { titleKey: 'nav.payments' } }]
