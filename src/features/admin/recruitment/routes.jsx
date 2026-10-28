import { lazyPage } from '@/app/lazyPage.js'

const recruitmentPage = lazyPage(() => import('./pages/RecruitmentPage.jsx'))

/* Data view and Funnel view are two states of one page, each with its own URL. */
export default [
  { path: 'recruitment', lazy: recruitmentPage },
  { path: 'recruitment/funnel', lazy: recruitmentPage, handle: { title: 'Recruitment' } },
]
