import { lazyPage } from '@/app/lazyPage.js'

const websitePage = lazyPage(() => import('./pages/WebsitePage.jsx'))
const editorPage = lazyPage(() => import('./pages/BlogEditorPage.jsx'))
const issuePage = lazyPage(() => import('./pages/NewsletterIssuePage.jsx'))

/* Admin › Website (2026-11-13): the Blog and Subscribers tabs, and the post editor; the Newsletter tab and issue editor (2026-11-19). */
export default [
  { path: 'website', lazy: websitePage },
  { path: 'website/subscribers', lazy: websitePage },
  { path: 'website/newsletter', lazy: websitePage },
  { path: 'website/newsletter/:issueId', lazy: issuePage },
  { path: 'website/blog/new', lazy: editorPage },
  { path: 'website/blog/:postId/edit', lazy: editorPage },
]
