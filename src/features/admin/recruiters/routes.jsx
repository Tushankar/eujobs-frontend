import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'recruiters', lazy: lazyPage(() => import('./pages/RecruitersPage.jsx')) }]
