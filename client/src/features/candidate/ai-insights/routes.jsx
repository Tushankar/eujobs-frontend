import { lazyPage } from '@/app/lazyPage.js'

export default [
  { path: 'ai-insights', lazy: lazyPage(() => import('./pages/AiInsightsPage.jsx')), handle: { title: 'AI Profile Insights' } },
  { path: 'ai-insights/skill-gap', lazy: lazyPage(() => import('./pages/SkillGapPage.jsx')), handle: { title: 'Skill Gap' } },
  {
    path: 'ai-insights/improve-profile',
    lazy: lazyPage(() => import('./pages/ImproveProfilePage.jsx')),
    handle: { title: 'Profile Improvement' },
  },
  { path: 'ai-insights/job-match', lazy: lazyPage(() => import('./pages/JobMatchPage.jsx')), handle: { title: 'Job Match Insights' } },
  {
    path: 'ai-insights/why-recommended',
    lazy: lazyPage(() => import('./pages/WhyRecommendedPage.jsx')),
    handle: { title: 'AI Recommendation Explanation' },
  },
]
