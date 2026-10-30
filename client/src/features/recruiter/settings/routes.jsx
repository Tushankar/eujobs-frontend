import { Navigate } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'

const handle = { title: 'Settings' }

export default [
  { path: 'settings', element: <Navigate to="notifications" replace /> },
  { path: 'settings/notifications', lazy: lazyPage(() => import('./pages/NotificationsPage.jsx')), handle },
  { path: 'settings/data-account', lazy: lazyPage(() => import('./pages/DataAccountPage.jsx')), handle },
  { path: 'settings/billing', lazy: lazyPage(() => import('./pages/BillingPage.jsx')), handle },
]
