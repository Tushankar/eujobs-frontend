import { lazyPage } from '@/app/lazyPage.js'

// §3.23: mounted in the candidate and recruiter workspaces. Item links open the thread at the card; the call has its own page.
// The header names Messages: an interview and a document request live in their thread.
const TITLE = { titleKey: 'nav.messages' }

export default [
  { path: 'interviews/:itemId', lazy: lazyPage(() => import('./pages/InterviewItemPage.jsx')), handle: TITLE },
  { path: 'document-requests/:itemId', lazy: lazyPage(() => import('./pages/DocumentRequestItemPage.jsx')), handle: TITLE },
  { path: 'interviews/:interviewId/call', lazy: lazyPage(() => import('./pages/CallPage.jsx')), handle: TITLE },
]
