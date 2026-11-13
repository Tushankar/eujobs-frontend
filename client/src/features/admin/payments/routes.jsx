import { lazyPage } from '@/app/lazyPage.js'

export default [
  { path: 'payments/plans', lazy: lazyPage(() => import('./pages/PlansPage.jsx')), handle: { titleKey: 'nav.payments' } },
  { path: 'payments/:paymentId?', lazy: lazyPage(() => import('./pages/PaymentsPage.jsx')), handle: { titleKey: 'nav.payments' } },
]
