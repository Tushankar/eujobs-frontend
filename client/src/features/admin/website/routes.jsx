import { lazyPage } from '@/app/lazyPage.js'

const websitePage = lazyPage(() => import('./pages/WebsitePage.jsx'))
const editorPage = lazyPage(() => import('./pages/BlogEditorPage.jsx'))

/* Admin › Website (2026-11-13): the Blog and Subscribers tabs, and the post editor. */
export default [
  { path: 'website', lazy: websitePage },
  { path: 'website/subscribers', lazy: websitePage },
  { path: 'website/blog/new', lazy: editorPage },
  { path: 'website/blog/:postId/edit', lazy: editorPage },
]
