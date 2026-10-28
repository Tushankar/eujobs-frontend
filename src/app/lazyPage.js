/**
 * Route `lazy` helper for default-exported page components:
 *   { path: 'jobs', lazy: lazyPage(() => import('./pages/FindJobsPage.jsx')) }
 */
export function lazyPage(importPage) {
  return async () => ({ Component: (await importPage()).default })
}
