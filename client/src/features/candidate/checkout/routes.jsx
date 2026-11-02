import { lazyPage } from '@/app/lazyPage.js'

// M-125: Stripe's success_url; the shared page polls the session, then returns to the starting page.
export default [
  { path: 'checkout/return', lazy: lazyPage(() => import('@/features/payments/pages/CheckoutReturnPage.jsx')), handle: { titleKey: 'titles.checkoutReturn' } },
]
