import { lazyPage } from '@/app/lazyPage.js'

const rolesPage = lazyPage(() => import('./pages/RolesPage.jsx'))
const userAccessPage = lazyPage(() => import('./pages/UserAccessPage.jsx'))

/* Roles and User access share one heading (the layout); the two dialogs are child URLs of their tab. */
export default [
  {
    path: 'access-management',
    lazy: lazyPage(() => import('./pages/AccessManagementLayout.jsx')),
    children: [
      { index: true, lazy: rolesPage },
      { path: 'roles/new', lazy: rolesPage },
      { path: 'users', lazy: userAccessPage },
      { path: 'users/:userId', lazy: userAccessPage },
    ],
  },
]
