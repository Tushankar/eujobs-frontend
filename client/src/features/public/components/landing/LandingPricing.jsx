import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Check } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { bestSaving } from '@/features/payments/bestSaving.js'
import IntervalSwitch from '@/features/payments/components/IntervalSwitch.jsx'
import PlanPrice from '@/features/payments/components/PlanPrice.jsx'
import { cx } from '@/utils/cx.js'
import { useGetPublicPlansQuery } from '../../api.js'
import styles from './Landing.module.css'
import { SectionHead } from './LandingSections.jsx'

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin)

const ROLES = ['candidate', 'recruiter']
const SIGN_UP = { candidate: '/sign-up', recruiter: '/recruiter/sign-up' }
const REDUCE = '(prefers-reduced-motion: reduce)'
const ease = 'power3.out'

/**
 * Pricing on the landing page (owner 2026-11-13): the real plans of GET /plans (the same as /pricing) for job seekers
 * or recruiters, monthly or yearly: centred title and controls, then the plan cards, the paid one in gold.
 * Motion: the cards rise in once on scroll while their prices settle and the ticks draw themselves; switching role or
 * period re-animates only what changed. Reduce motion: fades only.
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
    <section ref={scope} id="pricing" className={`${styles.band} ${styles.anchor}`} aria-labelledby="pricing-title">
      <div className={`${styles.container} ${styles.section} ${styles.pricing}`}>
        <SectionHead id="pricing-title" center eyebrow={t('landing:pricing.eyebrow')} lead={t('website:pricing.titleLead')} accent={t('website:pricing.titleAccent')} text={t('website:pricing.text')} />
        <div className={styles.pricingControls} data-reveal>
          <div ref={tabs} className={styles.segments} role="tablist" aria-label={t('website:pricing.for')}>
            <span ref={marker} className={styles.segmentMarker} aria-hidden="true" />
            {ROLES.map((entry) => (
              <button key={entry} type="button" role="tab" aria-selected={entry === role} className={styles.segment} onClick={() => setRole(entry)}>
                {t(`website:pricing.${entry}`)}
              </button>
            ))}
          </div>
          {saving > 0 && <IntervalSwitch value={interval} onChange={setInterval} saving={saving} className={styles.interval} />}
        </div>

        {plans ? (
          <div className={styles.priceCards} role="tabpanel">
            {plans.map((plan) => {
              const paid = plan.price?.amountMinor > 0
              return (
                <article key={plan.key} className={cx(styles.priceCard, paid && styles.priceCardFeatured)} data-plan-card data-plan={plan.key}>
                  <div className={styles.priceHead}>
                    <h3 className={styles.priceName}>{plan.name}</h3>
                    {paid && <span className={styles.priceBadge}>{t('website:pricing.recommended')}</span>}
                  </div>
                  <PlanPrice plan={plan} interval={interval} className={styles.priceAmount} />
                  <Link to={SIGN_UP[role]} className={cx(styles.priceCta, paid && styles.priceCtaGold)}>
                    {t(paid ? 'website:pricing.startPaid' : 'website:pricing.startFree')}
                  </Link>
                  <ul className={styles.priceFeatures}>
                    {paid && free && (
                      <li className={styles.priceEverything} data-plan-feature>
                        <Icon as={Check} size={16} strokeWidth={2.4} />
                        {t('website:pricing.everything', { plan: free.name })}
                      </li>
                    )}
                    {plan.features.map((feature) => (
                      <li key={feature} data-plan-feature>
                        <Icon as={Check} size={16} strokeWidth={2.4} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        ) : (
          <SkeletonRegion className={styles.priceCards}>
            <Skeleton height={460} />
            <Skeleton height={460} />
          </SkeletonRegion>
        )}
        <Link to={role === 'recruiter' ? '/pricing?for=recruiter' : '/pricing'} className={styles.pricingDetails}>
          {t('landing:pricing.details')}
        </Link>
      </div>
    </section>
  )
}
