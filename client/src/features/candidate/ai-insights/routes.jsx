import { lazyPage } from '@/app/lazyPage.js'

// AI insights belongs to AI Matches Plus: PlusGate shows these pages to Plus candidates and an upgrade screen otherwise.
export default [
  {
    path: 'ai-insights',
    lazy: lazyPage(() => import('../billing/components/PlusGate.jsx')),
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/AiInsightsPage.jsx')), handle: { title: 'AI Profile Insights' } },
      { path: 'skill-gap', lazy: lazyPage(() => import('./pages/SkillGapPage.jsx')), handle: { title: 'Skill Gap' } },
      {
        path: 'improve-profile',
        lazy: lazyPage(() => import('./pages/ImproveProfilePage.jsx')),
        handle: { title: 'Profile Improvement' },
      },
      { path: 'job-match', lazy: lazyPage(() => import('./pages/JobMatchPage.jsx')), handle: { title: 'Job Match Insights' } },
      {
        path: 'why-recommended',
        lazy: lazyPage(() => import('./pages/WhyRecommendedPage.jsx')),
        handle: { title: 'AI Recommendation Explanation' },
      },
    ],
  },
]
