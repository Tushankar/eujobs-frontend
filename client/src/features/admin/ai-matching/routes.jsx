import { lazyPage } from '@/app/lazyPage.js'

/* One splat route: /ai-matching and /ai-matching/policies/new share a single mounted page (the latter opens the create dialog). */
export default [
  {
    path: 'ai-matching/*',
    lazy: lazyPage(() => import('./pages/AiMatchingPage.jsx')),
    handle: { title: 'AI & matching' },
  },
]
