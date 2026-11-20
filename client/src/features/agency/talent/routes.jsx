import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'talent', lazy: lazyPage(() => import('./pages/TalentPage.jsx')) }]
