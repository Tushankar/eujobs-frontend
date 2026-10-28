import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'verification', lazy: lazyPage(() => import('./pages/VerificationPage.jsx')) }]
