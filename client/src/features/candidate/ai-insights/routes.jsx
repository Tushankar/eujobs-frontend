import { lazyPage } from '@/app/lazyPage.js'

// AI insights needs the `ai` entitlement (M-118): RequirePlan shows these pages to Plus candidates, the upgrade card otherwise.
export default [
  {
    path: 'ai-insights',
    lazy: lazyPage(() => import('../billing/components/RequirePlan.jsx')),
    handle: { entitlement: 'ai' },
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/AiInsightsPage.jsx')), handle: { titleKey: 'titles.aiProfileInsights' } },
      { path: 'skill-gap', lazy: lazyPage(() => import('./pages/SkillGapPage.jsx')), handle: { titleKey: 'titles.skillGap' } },
      {
        path: 'improve-profile',
        lazy: lazyPage(() => import('./pages/ImproveProfilePage.jsx')),
        handle: { titleKey: 'titles.profileImprovement' },
      },
      { path: 'job-match', lazy: lazyPage(() => import('./pages/JobMatchPage.jsx')), handle: { titleKey: 'titles.jobMatchInsights' } },
      {
        path: 'why-recommended',
        lazy: lazyPage(() => import('./pages/WhyRecommendedPage.jsx')),
        handle: { titleKey: 'titles.aiRecommendationExplanation' },
      },
    ],
  },
]
