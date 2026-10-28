import { createBrowserRouter, Navigate } from 'react-router-dom'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout.jsx'
import { WORKSPACES } from './workspaces.js'
import NotFoundPage from './NotFoundPage.jsx'
import authRoutes from '@/features/auth/routes.jsx'
import candidateRoutes from '@/features/candidate/routes.jsx'
import recruiterRoutes from '@/features/recruiter/routes.jsx'
import adminRoutes from '@/features/admin/routes.jsx'

function workspaceRoute(id, children) {
  const workspace = WORKSPACES[id]
  return {
    path: workspace.basePath,
    element: <WorkspaceLayout workspaceId={id} />,
    children: [
      ...children,
      { path: '*', element: <NotFoundPage homePath={workspace.basePath} homeLabel={`Back to ${workspace.label.toLowerCase()} overview`} /> },
    ],
  }
}

/*
 * Route tree. Each role's `routes.jsx` auto-collects the `routes.jsx` of every feature
 * folder beneath it (see features/<role>/routes.jsx), so adding a screen never
 * requires editing this file.
 */
const routes = [
  { path: '/', element: <Navigate to="/sign-in" replace /> },
  ...authRoutes,
  workspaceRoute('candidate', candidateRoutes),
  workspaceRoute('recruiter', recruiterRoutes),
  workspaceRoute('admin', adminRoutes),
  { path: '*', element: <NotFoundPage /> },
]

// Pages are lazy-loaded, so the first render needs a fallback while the matched page chunk loads.
const hydrateFallbackElement = (
  <p className="sr-only" role="status">
    Loading…
  </p>
)

export const router = createBrowserRouter(routes.map((route) => ({ ...route, hydrateFallbackElement })))
