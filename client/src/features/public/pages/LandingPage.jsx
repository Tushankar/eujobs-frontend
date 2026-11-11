import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useGetLandingQuery } from '../api.js'
import LandingHero from '../components/landing/LandingHero.jsx'
import { CallToAction, CareerBanner, Categories, Faq, Footer, Steps, TrustedStrip, Vacancies } from '../components/landing/LandingSections.jsx'
import styles from '../components/landing/Landing.module.css'
import { useLandingMotion } from '../components/landing/useLandingMotion.js'

/**
 * The public home page at / for signed-out visitors (Figma 396:547, owner decisions 2026-11-11): live jobs, counts and
 * FAQs from GET /landing. Testimonials, blogs and the newsletter of the design stay out until they have a backend.
 */
export default function LandingPage() {
  const { i18n, t } = useTranslation()
  const { data, isError } = useGetLandingQuery(i18n.language)
  useDocumentTitle(null)
  const root = useRef(null)
  useLandingMotion(root, Boolean(data) || isError)

  return (
    <div ref={root} className={styles.page}>
      <main className={styles.column}>
        <LandingHero />
        <TrustedStrip />
        <Categories counts={data?.counts} />
        <Steps />
        {isError ? <p className={`${styles.card} ${styles.empty}`}>{t('landing:loadError')}</p> : <Vacancies jobs={data?.jobs ?? null} />}
        <CareerBanner />
        {data && <Faq faqs={data.faqs} />}
        <CallToAction />
        <Footer total={data?.total} />
      </main>
    </div>
  )
}
