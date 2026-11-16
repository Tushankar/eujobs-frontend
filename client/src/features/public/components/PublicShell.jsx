import { useTranslation } from 'react-i18next'
import { useGetLandingQuery } from '../api.js'
import { SiteHeader } from './landing/LandingHero.jsx'
import { Footer } from './landing/LandingSections.jsx'
import landing from './landing/Landing.module.css'
import styles from './PublicShell.module.css'
import StickyNav from './StickyNav.jsx'
import { useHiddenScrollbar } from './useHiddenScrollbar.js'

/** The landing page's header and footer around a public page (blog, pricing, newsletter; 2026-11-13). */
export default function PublicShell({ children }) {
  const { i18n } = useTranslation()
  const { data } = useGetLandingQuery(i18n.language)
  useHiddenScrollbar()
  return (
    <div className={landing.page}>
      <StickyNav />
      <SiteHeader className={styles.header} />
      <div className={landing.column}>
        <main className={styles.main}>{children}</main>
      </div>
      <div className={styles.footer}>
        <Footer total={data?.total} contact={data?.contact} />
      </div>
    </div>
  )
}
