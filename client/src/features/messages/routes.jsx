import { lazyPage } from '@/app/lazyPage.js'

// Messages (OD16) for candidates and recruiters, mounted in both workspaces; reading is never plan-gated (§3.3).
export default [
  { path: 'messages', lazy: lazyPage(() => import('./pages/InboxPage.jsx')) },
  { path: 'messages/:conversationId', lazy: lazyPage(() => import('./pages/ThreadPage.jsx')) },
]
