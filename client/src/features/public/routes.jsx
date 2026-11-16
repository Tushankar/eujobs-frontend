import { redirect } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'
import { landingPath, loadMe } from '@/app/session.js'

/** /jobs is for signed-out visitors: a candidate goes to the same job or search in Find jobs, other roles home. */
async function jobsLoader({ request }) {
  const me = await loadMe()
  if (!me) return null
  if (me.role !== 'candidate') return redirect(landingPath(me))
  const params = new URL(request.url).searchParams
  const job = params.get('job')
  const q = [params.get('q'), params.get('location')].filter(Boolean).join(' ')
  return redirect(job ? `/candidate/jobs/${job}` : q ? `/candidate/jobs?q=${encodeURIComponent(q)}` : '/candidate/jobs')
}

/*
 * Public pages outside the auth flows (absolute paths): the legal texts (M-191), the certificate check (M-105), and the
 * public website's blog, pricing and newsletter double opt-in (2026-11-13), and the public job list (2026-11-16).
 */
export default [
  { path: '/legal/:doc', lazy: lazyPage(() => import('./pages/LegalPage.jsx')) },
  { path: '/certificates/:code', lazy: lazyPage(() => import('./pages/CertificatePage.jsx')) },
  { path: '/blog', lazy: lazyPage(() => import('./pages/BlogListPage.jsx')) },
  { path: '/blog/:slug', lazy: lazyPage(() => import('./pages/BlogPostPage.jsx')) },
  { path: '/jobs', loader: jobsLoader, lazy: lazyPage(() => import('./pages/PublicJobsPage.jsx')) },
  { path: '/pricing', lazy: lazyPage(() => import('./pages/PricingPage.jsx')) },
  { path: '/newsletter/:action', lazy: lazyPage(() => import('./pages/NewsletterPage.jsx')) },
]
