import { useLayoutEffect } from 'react'
import { createBrowserRouter, Outlet, redirect, useLocation, useNavigationType } from 'react-router-dom'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout.jsx'
import HydrateFallback from '@/components/layout/HydrateFallback.jsx'
import { WORKSPACES } from './workspaces.js'
import NotFoundPage from './NotFoundPage.jsx'
import { setRouter } from './navigation.js'
import { landingPath, loadMe, requiredPage } from './session.js'
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
    element: <WorkspaceLayout workspaceId={id} />,
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
    path: '/',
    loader: async () => {
      const me = await loadMe()
      return redirect(me ? landingPath(me) : '/sign-in')
    },
  },
  ...authRoutes,
  ...publicRoutes,
  workspaceRoute('candidate', candidateRoutes),
  workspaceRoute('recruiter', recruiterRoutes),
  workspaceRoute('admin', adminRoutes),
  { path: '*', element: <NotFoundPage /> },
]

/**
 * Every page opens at the top: a new path scrolls the window up. Back/Forward (POP) keeps the browser's position, and
 * a change of only the query (filters, tabs) does not move the page.
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname]) // only a new path resets the scroll, so navigationType is left out on purpose
  return <Outlet />
}

// The first render waits for the loaders (GET /me), so it shows a loading state meanwhile.
export const router = createBrowserRouter([{ element: <ScrollToTop />, children: routes.map((route) => ({ ...route, HydrateFallback })) }])
setRouter(router)
