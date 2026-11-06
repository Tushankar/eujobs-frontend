import { lazyPage } from '@/app/lazyPage.js'

// §3.23: mounted in the candidate and recruiter workspaces. Item links open the thread at the card; the call has its own page.
export default [
  { path: 'interviews/:itemId', lazy: lazyPage(() => import('./pages/InterviewItemPage.jsx')) },
  { path: 'document-requests/:itemId', lazy: lazyPage(() => import('./pages/DocumentRequestItemPage.jsx')) },
  { path: 'interviews/:interviewId/call', lazy: lazyPage(() => import('./pages/CallPage.jsx')) },
]
