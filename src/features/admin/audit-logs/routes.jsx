import { lazyPage } from '@/app/lazyPage.js'

export default [{ path: 'audit-logs', lazy: lazyPage(() => import('./pages/AuditLogsPage.jsx')) }]
