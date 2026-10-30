import { Navigate } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'

export default [
  {
    path: 'settings',
    lazy: lazyPage(() => import('./components/SettingsLayout.jsx')),
    handle: { title: 'Settings' },
    children: [
      { index: true, element: <Navigate to="privacy" replace /> },
      { path: 'privacy', lazy: lazyPage(() => import('./pages/PrivacySettingsPage.jsx')) },
      { path: 'notifications', lazy: lazyPage(() => import('./pages/NotificationSettingsPage.jsx')) },
      { path: 'data-account', lazy: lazyPage(() => import('./pages/DataAccountSettingsPage.jsx')) },
      { path: 'billing', lazy: lazyPage(() => import('./pages/BillingSettingsPage.jsx')) },
    ],
  },
]
