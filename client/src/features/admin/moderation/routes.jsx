import { lazyPage } from '@/app/lazyPage.js'

/* One splat route: the queues and their review dialogs (…/content/:itemId, …/accounts/:accountId) share a single mounted page. */
export default [
  {
    path: 'moderation/*',
    lazy: lazyPage(() => import('./pages/ModerationPage.jsx')),
    handle: { titleKey: 'nav.moderation' },
  },
]
