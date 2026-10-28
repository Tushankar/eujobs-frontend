import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { WORKSPACES } from '@/app/workspaces.js'
import { cx } from '@/utils/cx.js'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import { WorkspacePreferencesProvider } from './WorkspacePreferences.jsx'
import styles from './WorkspaceLayout.module.css'

/** Authenticated shell shared by all three roles: sidebar + header + routed content + footer. */
export default function WorkspaceLayout({ workspaceId }) {
  const workspace = WORKSPACES[workspaceId]
  const { pathname } = useLocation()
  // The mobile drawer remembers the path it was opened on, so navigating anywhere closes it.
  const [drawerPath, setDrawerPath] = useState(null)
  const drawerOpen = drawerPath === pathname

  return (
    <WorkspacePreferencesProvider>
      <Sidebar workspace={workspace} open={drawerOpen} onClose={() => setDrawerPath(null)} />
      <div className={styles.platform}>
        <Header workspace={workspace} onOpenMenu={() => setDrawerPath(pathname)} />
        <main className={styles.main}>
          {/* Keyed by path so each page's sections cascade in again on navigation (utilities.css). */}
          <div className={cx(styles.content, 'stagger-page')} key={pathname}>
            <Outlet context={{ workspace }} />
          </div>
          <footer className={styles.footer}>
            <div className={styles.footerRow}>
              <p>© 2026 Local Workman. · AI Job Portal</p>
              <p className={styles.footerNote}>
                <span className={styles.footerDot} aria-hidden="true" />
                Interactive demo · Changes saved on this device
              </p>
            </div>
          </footer>
        </main>
      </div>
    </WorkspacePreferencesProvider>
  )
}
