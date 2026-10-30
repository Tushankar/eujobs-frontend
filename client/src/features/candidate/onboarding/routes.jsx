import { Navigate } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'

export default [
  {
    path: 'onboarding',
    children: [
      { index: true, element: <Navigate replace to="story" /> },
      { path: 'story', lazy: lazyPage(() => import('./pages/StoryStepPage.jsx')), handle: { titleKey: 'titles.onboarding' } },
      { path: 'preferences', lazy: lazyPage(() => import('./pages/PreferencesStepPage.jsx')), handle: { titleKey: 'titles.preferences' } },
      { path: 'plan', lazy: lazyPage(() => import('./pages/PlanStepPage.jsx')), handle: { titleKey: 'titles.choosePlan' } },
    ],
  },
]
