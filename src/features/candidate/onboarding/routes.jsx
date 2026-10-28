import { Navigate } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'

export default [
  {
    path: 'onboarding',
    children: [
      { index: true, element: <Navigate replace to="story" /> },
      { path: 'story', lazy: lazyPage(() => import('./pages/StoryStepPage.jsx')), handle: { title: 'Onboarding' } },
      { path: 'preferences', lazy: lazyPage(() => import('./pages/PreferencesStepPage.jsx')), handle: { title: 'Preferences' } },
    ],
  },
]
