import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import ForbiddenPage from '@/app/ForbiddenPage.jsx'
import { adminHome, adminNavItemFor, can } from '@/app/permissions.js'
import { WORKSPACES } from '@/app/workspaces.js'
import { usePreferences } from '@/lib/preferences.js'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import UpgradeDialog from '@/features/candidate/billing/components/UpgradeDialog.jsx'
import LegalAcceptDialog from '@/features/public/components/LegalAcceptDialog.jsx'
import ProductTour from '@/features/tour/ProductTour.jsx'
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
  const { me } = usePreferences()
  const page = workspaceId === 'admin' ? adminNavItemFor(pathname) : null
  const blocked = page && me && !can(me, page.permission) ? page : null

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
            {blocked ? (
              // The Overview sends an admin without it to their first page; any other page shows the 403 page.
              blocked.end ? <Navigate to={adminHome(me)} replace /> : <ForbiddenPage permission={blocked.permission} homePath={adminHome(me)} />
            ) : (
              <Outlet context={{ workspace }} />
            )}
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
      {['candidate', 'recruiter'].includes(workspaceId) && (
        <>
          <UpgradeDialog />
          <ProductTour workspace={workspace} />
        </>
      )}
    </>
  )
}
