import { useTranslation } from 'react-i18next'
import { useGetLandingQuery } from '../api.js'
import { SiteHeader } from './landing/LandingHero.jsx'
import { Footer } from './landing/LandingSections.jsx'
import landing from './landing/Landing.module.css'
import styles from './PublicShell.module.css'

/** The landing page's header and footer around a public page (blog, pricing, newsletter; 2026-11-13). */
export default function PublicShell({ children }) {
  const { i18n } = useTranslation()
  const { data } = useGetLandingQuery(i18n.language)
  return (
    <div className={landing.page}>
      <div className={landing.column}>
        <div className={`${landing.card} ${styles.header}`}>
          <SiteHeader />
        </div>
        <main className={styles.main}>{children}</main>
        <Footer total={data?.total} contact={data?.contact} />
      </div>
    </div>
  )
}
