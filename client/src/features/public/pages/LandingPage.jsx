import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useGetLandingQuery } from '../api.js'
import LandingHero from '../components/landing/LandingHero.jsx'
import { CallToAction, CareerBanner, Categories, Faq, Footer, Steps, TrustedStrip, Vacancies } from '../components/landing/LandingSections.jsx'
import LandingPricing from '../components/landing/LandingPricing.jsx'
import { Blogs, Testimonials } from '../components/landing/LandingStories.jsx'
import styles from '../components/landing/Landing.module.css'
import StickyNav from '../components/StickyNav.jsx'
import { useHiddenScrollbar } from '../components/useHiddenScrollbar.js'
import { scrollToSection, useLandingMotion } from '../components/landing/useLandingMotion.js'

/**
 * The public home page at / for signed-out visitors (Figma 396:546, owner decisions 2026-11-11 and 2026-11-13): live
 * jobs, counts, approved reviews, FAQs, the newest blog posts and the footer contact from GET /landing. A link such as
 * /#jobs from another public page scrolls to its section once the data is in.
 */
export default function LandingPage() {
  const { i18n, t } = useTranslation()
  const { data, isError } = useGetLandingQuery(i18n.language)
  const { hash } = useLocation()
  useDocumentTitle(null)
  useHiddenScrollbar()
  const root = useRef(null)
  const ready = Boolean(data) || isError
  useLandingMotion(root, ready)

  useEffect(() => {
    const target = ready && hash && document.querySelector(hash)
    if (target) scrollToSection(target)
  }, [ready, hash])

  return (
    <div ref={root} className={styles.page}>
      <StickyNav />
      <main className={styles.column}>
        <LandingHero />
        <TrustedStrip />
        <Categories counts={data?.counts} />
        <Steps />
        {isError ? <p className={`${styles.card} ${styles.empty}`}>{t('landing:loadError')}</p> : <Vacancies jobs={data?.jobs ?? null} />}
        <CareerBanner />
        <Testimonials reviews={data?.reviews} />
        <LandingPricing />
        {data && <Faq faqs={data.faqs} />}
        <Blogs posts={data?.posts} />
        <CallToAction />
        <Footer total={data?.total} contact={data?.contact} />
      </main>
    </div>
  )
}
