import { lazyPage } from '@/app/lazyPage.js'

// The seven Figma profile frames are one screen: a shared layout (summary + tabs + sidebar) with a nested route per tab.
export default [
  { path: 'find-candidates', lazy: lazyPage(() => import('./pages/FindCandidatesPage.jsx')) },
  {
    path: 'find-candidates/:candidateId',
    lazy: lazyPage(() => import('./pages/CandidateProfilePage.jsx')),
    handle: { title: 'Find candidates' },
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/CandidateOverviewPage.jsx')) },
      { path: 'experience', lazy: lazyPage(() => import('./pages/CandidateExperiencePage.jsx')) },
      { path: 'skills', lazy: lazyPage(() => import('./pages/CandidateSkillsPage.jsx')) },
      { path: 'education', lazy: lazyPage(() => import('./pages/CandidateEducationPage.jsx')) },
      { path: 'resume', lazy: lazyPage(() => import('./pages/CandidateResumePage.jsx')) },
      { path: 'activity', lazy: lazyPage(() => import('./pages/CandidateActivityPage.jsx')) },
      { path: 'notes', lazy: lazyPage(() => import('./pages/CandidateNotesPage.jsx')) },
    ],
  },
]
