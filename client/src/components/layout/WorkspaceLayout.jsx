import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { WORKSPACES } from '@/app/workspaces.js'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import LegalAcceptDialog from '@/features/public/components/LegalAcceptDialog.jsx'
import { cx } from '@/utils/cx.js'
import Copyright from './Copyright.jsx'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import styles from './WorkspaceLayout.module.css'

const LEGAL_DOCS = ['terms', 'privacy', 'imprint']

/** Authenticated shell shared by all three roles: sidebar + header + routed content + footer. */
export default function WorkspaceLayout({ workspaceId }) {
  const { t } = useTranslation()
  const workspace = WORKSPACES[workspaceId]
  const { pathname, state } = useLocation()
  // The mobile drawer remembers the path it was opened on, so navigating anywhere closes it.
  const [drawerPath, setDrawerPath] = useState(null)
  const drawerOpen = drawerPath === pathname

  return (
    <>
      <Sidebar workspace={workspace} open={drawerOpen} onClose={() => setDrawerPath(null)} />
      <div className={styles.platform}>
        <Header workspace={workspace} onOpenMenu={() => setDrawerPath(pathname)} />
        <main className={styles.main}>
          {/* Keyed by path so each page's sections cascade in again on navigation (utilities.css). */}
          <div className={cx(styles.content, 'stagger-page')} key={pathname}>
            {/* M-005: signed in on the other portal, so this account's own workspace opened instead. */}
            {state?.notice === 'wrongPortal' && <NoticeBanner>{t('shell:notices.wrongPortal')}</NoticeBanner>}
            <Outlet context={{ workspace }} />
          </div>
          <footer className={styles.footer}>
            <div className={styles.footerRow}>
              <p>
                <Copyright />
              </p>
              <nav className={styles.footerLinks} aria-label={t('shell:footer.legal')}>
                {LEGAL_DOCS.map((doc) => (
                  <Link key={doc} to={`/legal/${doc}`}>
                    {t(`legal:docs.${doc}`)}
                  </Link>
                ))}
              </nav>
            </div>
          </footer>
        </main>
      </div>
      <LegalAcceptDialog />
    </>
  )
}
