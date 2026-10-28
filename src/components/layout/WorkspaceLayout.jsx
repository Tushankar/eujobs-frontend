import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { WORKSPACES } from '@/app/workspaces.js'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import { WorkspacePreferencesProvider } from './WorkspacePreferences.jsx'
import styles from './WorkspaceLayout.module.css'

/** Authenticated shell shared by all three roles: sidebar + header + routed content + footer. */
export default function WorkspaceLayout({ workspaceId }) {
  const workspace = WORKSPACES[workspaceId]
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  return (
    <WorkspacePreferencesProvider>
      <Sidebar workspace={workspace} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className={styles.platform}>
        <Header workspace={workspace} onOpenMenu={() => setDrawerOpen(true)} />
        <main className={styles.main}>
          <div className={styles.content}>
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
