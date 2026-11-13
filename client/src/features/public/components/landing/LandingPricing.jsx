import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Check } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import glowBlue from '@/assets/landing/jobs-glow-blue.svg'
import glowGreen from '@/assets/landing/jobs-glow-green.svg'
import contours from '@/assets/landing/pattern-contours.svg?raw'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { bestSaving } from '@/features/payments/bestSaving.js'
import IntervalSwitch from '@/features/payments/components/IntervalSwitch.jsx'
import PlanPrice from '@/features/payments/components/PlanPrice.jsx'
import { cx } from '@/utils/cx.js'
import { useGetPublicPlansQuery } from '../../api.js'
import InlineSvg from './InlineSvg.jsx'
import styles from './Landing.module.css'
import { ArrowPill } from './LandingHero.jsx'

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin)

const ROLES = ['candidate', 'recruiter']
const SIGN_UP = { candidate: '/sign-up', recruiter: '/recruiter/sign-up' }
const TRUST = ['vat', 'stripe', 'cancel']
const REDUCE = '(prefers-reduced-motion: reduce)'
const ease = 'power3.out'

/**
 * Pricing on the landing page (owner 2026-11-13): the real plans of GET /plans (the same as /pricing) for job seekers
 * or recruiters, monthly or yearly, in a compact split: intro and controls on the left, the plan cards on the right.
 * Motion: the cards rise in once on scroll while their prices settle and the ticks draw themselves; the recommended
 * card catches a slow light sweep; switching role or period re-animates only what changed. Reduce motion: fades only.
 */
export default function LandingPricing() {
  const { t, i18n } = useTranslation()
  const [role, setRole] = useState('candidate')
  const [interval, setInterval] = useState('month')
  const { currentData: plans, isError } = useGetPublicPlansQuery({ role, language: i18n.language })
  const scope = useRef(null)
  const tabs = useRef(null)
  const marker = useRef(null)
  const seen = useRef(false)
  const saving = bestSaving(plans)
  const free = plans?.find((plan) => plan.price?.amountMinor === 0)

  // The cards' entrance: on first scroll into view, then straight away after a role switch.
  useGSAP(
    () => {
      if (!plans) return
      const q = gsap.utils.selector(scope)
      const reduce = window.matchMedia(REDUCE).matches
      const move = reduce ? 0 : 1
      const timeline = gsap.timeline({ paused: true, defaults: { ease } })
      timeline
        .from(q('[data-plan-card]'), { y: 56 * move, opacity: 0, duration: 0.9, stagger: 0.14, clearProps: 'transform,opacity' })
        .from(q('[data-plan-price]'), { y: 18 * move, opacity: 0, duration: 0.7, stagger: 0.14 }, 0.25)
        .from(q('[data-plan-feature]'), { x: -10 * move, opacity: 0, duration: 0.5, stagger: 0.035 }, 0.4)
      if (move) {
        timeline.fromTo(q('[data-plan-feature] svg path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.45, stagger: 0.035, ease: 'power2.inOut' }, 0.5)
        const sheen = q('[data-sheen]')
        gsap.set(sheen, { xPercent: -140, skewX: -14 })
        const sweep = gsap.to(sheen, { xPercent: 340, duration: 1.6, ease: 'power2.inOut', repeat: -1, repeatDelay: 5, paused: true })
        timeline.add(() => sweep.play(), '-=0.2')
      }
      if (seen.current) timeline.play()
      else {
        ScrollTrigger.create({
          trigger: scope.current,
          start: 'top 80%',
          once: true,
          onEnter: () => {
            seen.current = true
            timeline.play()
          },
        })
      }
      // The section grew from its placeholder: later sections' scroll triggers must measure again.
      ScrollTrigger.refresh()
    },
    { scope, dependencies: [plans], revertOnUpdate: true },
  )

  // Monthly ↔ yearly: the prices roll over.
  const firstInterval = useRef(true)
  useGSAP(
    () => {
      if (firstInterval.current) {
        firstInterval.current = false
        return
      }
      const reduce = window.matchMedia(REDUCE).matches
      gsap.fromTo(
        gsap.utils.selector(scope)('[data-plan-price]'),
        { y: reduce ? 0 : 14, opacity: 0, filter: reduce ? 'none' : 'blur(4px)' },
        { y: 0, opacity: 1, filter: 'none', duration: 0.5, stagger: 0.06, ease, clearProps: 'filter,transform' },
      )
    },
    { scope, dependencies: [interval] },
  )

  // The role tabs' highlight glides to the chosen tab.
  useLayoutEffect(() => {
    const tab = tabs.current?.querySelector('[aria-selected="true"]')
    if (!tab || !marker.current) return
    const props = { x: tab.offsetLeft, width: tab.offsetWidth }
    if (window.matchMedia(REDUCE).matches || !marker.current.style.width) gsap.set(marker.current, props)
    else gsap.to(marker.current, { ...props, duration: 0.4, ease: 'power3.inOut' })
  }, [role, t])

  if (isError) return null

  return (
    <section ref={scope} id="pricing" className={`${styles.card} ${styles.pricing} ${styles.anchor}`} aria-labelledby="pricing-title">
      <InlineSvg svg={contours} className={styles.pricingContours} motion="pattern" />
      <img src={glowGreen} alt="" loading="lazy" className={styles.glow} style={{ left: 120, top: 260, width: 1113 }} aria-hidden="true" data-glow />
      <img src={glowBlue} alt="" loading="lazy" className={styles.glow} style={{ left: 360, top: 240, width: 1049 }} aria-hidden="true" data-glow />

      <div className={styles.pricingIntro} data-reveal>
        <h2 id="pricing-title" className={styles.sectionTitle}>
          {t('website:pricing.titleLead')} <span className={styles.accent}>{t('website:pricing.titleAccent')}</span>
        </h2>
        <p className={styles.sectionText}>{t('website:pricing.text')}</p>
        <div ref={tabs} className={styles.pricingTabs} role="tablist" aria-label={t('website:pricing.for')}>
          <span ref={marker} className={styles.pricingMarker} aria-hidden="true" />
          {ROLES.map((entry) => (
            <button key={entry} type="button" role="tab" aria-selected={entry === role} className={styles.pricingTab} onClick={() => setRole(entry)}>
              {t(`website:pricing.${entry}`)}
            </button>
          ))}
        </div>
        <div className={styles.pricingSwitch}>{saving > 0 && <IntervalSwitch value={interval} onChange={setInterval} saving={saving} />}</div>
        <ul className={styles.pricingTrust}>
          {TRUST.map((key) => (
            <li key={key}>
              <Icon as={Check} size={14} strokeWidth={2.4} />
              {t(`website:pricing.trust.${key}`)}
            </li>
          ))}
        </ul>
        <div className={styles.pricingDetails}>
          <ArrowPill to={role === 'recruiter' ? '/pricing?for=recruiter' : '/pricing'}>{t('landing:pricing.details')}</ArrowPill>
        </div>
      </div>

      {plans ? (
        <div className={styles.priceCards} role="tabpanel">
          {plans.map((plan) => {
            const paid = plan.price?.amountMinor > 0
            return (
              <article key={plan.key} className={cx(styles.priceCard, paid && styles.priceCardFeatured)} data-plan-card data-plan={plan.key}>
                {paid && <span className={styles.priceSheen} aria-hidden="true" data-sheen />}
                <div className={styles.priceHead}>
                  <h3 className={styles.priceName}>{plan.name}</h3>
                  {paid && <span className={styles.priceBadge}>{t('website:pricing.recommended')}</span>}
                </div>
                <PlanPrice plan={plan} interval={interval} className={styles.priceAmount} />
                {paid && free && <p className={styles.priceEverything}>{t('website:pricing.everything', { plan: free.name })}</p>}
                <ul className={styles.priceFeatures}>
                  {plan.features.map((feature) => (
                    <li key={feature} data-plan-feature>
                      <Icon as={Check} size={15} strokeWidth={2.4} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to={SIGN_UP[role]} className={cx(styles.priceCta, paid && styles.priceCtaPrimary)}>
                  {t(paid ? 'website:pricing.startPaid' : 'website:pricing.startFree')}
                </Link>
              </article>
            )
          })}
        </div>
      ) : (
        <SkeletonRegion className={styles.priceCards}>
          <Skeleton height={500} />
          <Skeleton height={500} />
        </SkeletonRegion>
      )}
    </section>
  )
}
