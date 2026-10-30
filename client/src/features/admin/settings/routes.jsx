import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'settings', lazy: lazyPage(() => import('./pages/AdminSettingsPage.jsx')), handle: { titleKey: 'titles.settings' } }]
