import { lazyPage } from '@/app/lazyPage.js'

/*
 * Public pages outside the auth flows (absolute paths): the legal texts (M-191), the certificate check (M-105), and the
 * public website's blog, pricing and newsletter double opt-in (2026-11-13).
 */
export default [
  { path: '/legal/:doc', lazy: lazyPage(() => import('./pages/LegalPage.jsx')) },
  { path: '/certificates/:code', lazy: lazyPage(() => import('./pages/CertificatePage.jsx')) },
  { path: '/blog', lazy: lazyPage(() => import('./pages/BlogListPage.jsx')) },
  { path: '/blog/:slug', lazy: lazyPage(() => import('./pages/BlogPostPage.jsx')) },
  { path: '/pricing', lazy: lazyPage(() => import('./pages/PricingPage.jsx')) },
  { path: '/newsletter/:action', lazy: lazyPage(() => import('./pages/NewsletterPage.jsx')) },
]
