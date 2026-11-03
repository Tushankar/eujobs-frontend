import { WORKSPACES, workspacePath } from './workspaces.js'

/*
 * Admin permissions in the UI (M-155): the server enforces every route; the sidebar, search and page actions hide
 * what `me.permissions` does not hold, and a direct URL to a page shows the 403 page. Owners hold every permission.
 */
export function can(me, permission) {
  return !permission || Boolean(me?.isOwner) || Boolean(me?.permissions?.includes(permission))
}

/** The admin nav item a path belongs to: the longest matching page path (the Overview only on /admin itself). */
export function adminNavItemFor(pathname) {
  const admin = WORKSPACES.admin
  const path = pathname.replace(/\/$/, '') || '/'
  return (
    admin.nav
      .filter((item) => {
        const base = workspacePath(admin, item.to)
        return item.end ? path === base : path === base || path.startsWith(`${base}/`)
      })
      .sort((a, b) => b.to.length - a.to.length)[0] ?? null
  )
}

/** Where an admin lands: the first page their permissions open, else Settings (which needs none). */
export function adminHome(me) {
  const item = WORKSPACES.admin.nav.find((entry) => can(me, entry.permission))
  return workspacePath(WORKSPACES.admin, item ? item.to : 'settings')
}
