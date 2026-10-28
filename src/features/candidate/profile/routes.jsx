import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'profile', lazy: lazyPage(() => import('./pages/ProfilePage.jsx')) }]
