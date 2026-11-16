import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useGetLandingQuery } from '../api.js'
import LandingHero, { SiteHeader } from '../components/landing/LandingHero.jsx'
import { CallToAction, CareerBanner, Categories, Faq, Footer, Steps, TrustedStrip, Vacancies } from '../components/landing/LandingSections.jsx'
import LandingPricing from '../components/landing/LandingPricing.jsx'
import { Blogs, Testimonials } from '../components/landing/LandingStories.jsx'
import styles from '../components/landing/Landing.module.css'
import StickyNav from '../components/StickyNav.jsx'
import { useHiddenScrollbar } from '../components/useHiddenScrollbar.js'
import { scrollToSection, useLandingMotion } from '../components/landing/useLandingMotion.js'

/**
 * The public home page at / for signed-out visitors (dark canvas "Main", owner 2026-11-16; light and dark themes): live
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
      <SiteHeader />
      <main>
        <LandingHero data={data} />
        <TrustedStrip />
        <Categories counts={data?.counts} />
        <Steps />
        {isError ? (
          <div className={styles.container}>
            <p className={styles.empty}>{t('landing:loadError')}</p>
          </div>
        ) : (
          <Vacancies jobs={data?.jobs ?? null} />
        )}
        <CareerBanner />
        <Testimonials reviews={data?.reviews} />
        <LandingPricing />
        {data && <Faq faqs={data.faqs} contact={data.contact} />}
        <Blogs posts={data?.posts} />
        <CallToAction />
      </main>
      <Footer total={data?.total} contact={data?.contact} />
    </div>
  )
}
