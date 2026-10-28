import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'candidates', lazy: lazyPage(() => import('./pages/CandidatesPage.jsx')) }]
