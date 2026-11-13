import { createBrowserRouter, redirect } from 'react-router-dom'
import HydrateFallback from '@/components/layout/HydrateFallback.jsx'
import { WORKSPACES } from './workspaces.js'
import NotFoundPage from './NotFoundPage.jsx'
import ScrollToTop from './ScrollToTop.jsx'
import { setRouter } from './navigation.js'
import { landingPath, loadMe, requiredPage } from './session.js'
import LandingPage from '@/features/public/pages/LandingPage.jsx'
import authRoutes from '@/features/auth/routes.jsx'
import publicRoutes from '@/features/public/routes.jsx'
import candidateRoutes from '@/features/candidate/routes.jsx'
import recruiterRoutes from '@/features/recruiter/routes.jsx'
import adminRoutes from '@/features/admin/routes.jsx'

// M-125, P3-C10: the onboarding plan step comes back from Stripe here before onboarding is complete.
const OPEN_DURING_ONBOARDING = '/candidate/checkout/return'

const here = (request) => {
  const url = new URL(request.url)
  return url.pathname + url.search
}

/** §3.1 for a workspace: signed out → its sign-in with ?next; another role → that role's landing; a required page wins. */
function workspaceLoader(id) {
  return async ({ request }) => {
    const me = await loadMe()
    if (!me) return redirect(`${WORKSPACES[id].signInPath}?next=${encodeURIComponent(here(request))}`)
    if (me.role !== id) return redirect(landingPath(me))
    const required = requiredPage(me)
    const { pathname } = new URL(request.url)
    if (required && !pathname.startsWith(required.prefix) && pathname !== OPEN_DURING_ONBOARDING) return redirect(required.path)
    return null
  }
}

function workspaceRoute(id, children) {
  const workspace = WORKSPACES[id]
  return {
    path: workspace.basePath,
    loader: workspaceLoader(id),
    // Loaded on demand so the signed-out landing page doesn't download the workspace shell.
    lazy: async () => {
      const { default: WorkspaceLayout } = await import('@/components/layout/WorkspaceLayout.jsx')
      return { element: <WorkspaceLayout workspaceId={id} /> }
    },
    children: [...children, { path: '*', element: <NotFoundPage homePath={workspace.basePath} workspaceId={id} /> }],
  }
}

/*
 * Route tree. Each role's `routes.jsx` auto-collects the `routes.jsx` of every feature
 * folder beneath it (see features/<role>/routes.jsx), so adding a screen never
 * requires editing this file.
 */
const routes = [
  {
    // Signed-out visitors get the public landing page (Figma 396:547); a session goes straight to its workspace.
    path: '/',
    loader: async () => {
      const me = await loadMe()
      return me ? redirect(landingPath(me)) : null
    },
    // Bundled with the app (not lazy) so the landing page doesn't wait for a second download.
    Component: LandingPage,
  },
  ...authRoutes,
  ...publicRoutes,
  workspaceRoute('candidate', candidateRoutes),
  workspaceRoute('recruiter', recruiterRoutes),
  workspaceRoute('admin', adminRoutes),
  { path: '*', element: <NotFoundPage /> },
]

// The first render waits for the loaders (GET /me), so it shows a loading state meanwhile.
export const router = createBrowserRouter([{ element: <ScrollToTop />, children: routes.map((route) => ({ ...route, HydrateFallback })) }])
setRouter(router)
