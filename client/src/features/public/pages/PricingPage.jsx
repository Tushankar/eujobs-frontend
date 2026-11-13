import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetPublicPlansQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import { ArrowPill } from '../components/landing/LandingHero.jsx'
import landing from '../components/landing/Landing.module.css'
import styles from '../components/PublicShell.module.css'

const ROLES = ['candidate', 'recruiter']
const SIGN_UP = { candidate: '/sign-up', recruiter: '/recruiter/sign-up' }

/**
 * /pricing (the nav's "Pricing Plan", 2026-11-13): the real plans of GET /plans for candidates or recruiters, priced in
 * the visitor's currency (EUR without one); the paid plan is the filled card.
 */
export default function PricingPage() {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const [params, setParams] = useSearchParams()
  const role = params.get('for') === 'recruiter' ? 'recruiter' : 'candidate'
  const { currentData: plans, isError } = useGetPublicPlansQuery({ role, language: i18n.language })
  useDocumentTitle(t('website:pricing.title'))

  return (
    <PublicShell>
      <section className={`${landing.card} ${styles.panel}`} aria-labelledby="pricing-title">
        <h1 id="pricing-title" className={styles.title}>
          {t('website:pricing.titleLead')} <span className={landing.accent}>{t('website:pricing.titleAccent')}</span>
        </h1>
        <p className={styles.lead}>{t('website:pricing.text')}</p>
        <div className={styles.tabs} role="tablist" aria-label={t('website:pricing.for')}>
          {ROLES.map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={entry === role}
              className={entry === role ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setParams(entry === 'recruiter' ? { for: 'recruiter' } : {}, { replace: true })}
            >
              {t(`website:pricing.${entry}`)}
            </button>
          ))}
        </div>

        {isError && <p className={styles.empty}>{t('website:loadError')}</p>}
        {!plans && !isError && (
          <SkeletonRegion className={styles.plans}>
            <Skeleton height={380} />
            <Skeleton height={380} />
          </SkeletonRegion>
        )}
        {plans && (
          <div className={styles.plans} role="tabpanel">
            {plans.map((plan) => {
              const paid = plan.price?.amountMinor > 0
              return (
                <article key={plan.key} className={paid ? `${styles.plan} ${styles.planFeatured}` : styles.plan}>
                  <h2 className={styles.planName}>{plan.name}</h2>
                  <p className={styles.price}>
                    {plan.price ? format.money(plan.price.amountMinor, plan.price.currency) : '—'}
                    {paid && <span className={styles.interval}>{t('website:pricing.perMonth')}</span>}
                  </p>
                  <ul className={styles.features}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Icon as={Check} size={16} className={styles.check} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.planAction}>
                    <ArrowPill to={SIGN_UP[role]} white={paid}>
                      {t(paid ? 'website:pricing.startPaid' : 'website:pricing.startFree')}
                    </ArrowPill>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </PublicShell>
  )
}
