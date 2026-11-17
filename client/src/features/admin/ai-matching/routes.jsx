import { lazyPage } from '@/app/lazyPage.js'

/* One splat route: /ai-matching and /ai-matching/policies/new share a single mounted page (the latter opens the create dialog).
   /ai-matching/usage is the Usage tab (2026-11-17). */
export default [
  {
    path: 'ai-matching/usage',
    lazy: lazyPage(() => import('./pages/UsagePage.jsx')),
    handle: { titleKey: 'nav.aiMatching' },
  },
  {
    path: 'ai-matching/*',
    lazy: lazyPage(() => import('./pages/AiMatchingPage.jsx')),
    handle: { titleKey: 'nav.aiMatching' },
  },
]
