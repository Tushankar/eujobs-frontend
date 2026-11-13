import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import IntervalSwitch from '@/features/payments/components/IntervalSwitch.jsx'
import { bestSaving } from '@/features/payments/bestSaving.js'
import PlanPrice from '@/features/payments/components/PlanPrice.jsx'
import { cx } from '@/utils/cx.js'
import { useGetPublicPlansQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import landing from '../components/landing/Landing.module.css'
import shell from '../components/PublicShell.module.css'
import styles from './PricingPage.module.css'

const ROLES = ['candidate', 'recruiter']
const SIGN_UP = { candidate: '/sign-up', recruiter: '/recruiter/sign-up' }
const TRUST = ['vat', 'stripe', 'cancel']

/**
 * /pricing (the nav's "Pricing Plan", 2026-11-13): the real plans of GET /plans for candidates or recruiters, priced in
 * the visitor's currency (EUR without one), monthly or yearly. Quiet cards: the paid plan is marked by a firm edge and
 * a "Recommended" label, not by colour (owner, 2026-11-13).
 */
export default function PricingPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [interval, setInterval] = useState('month')
  const role = params.get('for') === 'recruiter' ? 'recruiter' : 'candidate'
  const { currentData: plans, isError } = useGetPublicPlansQuery({ role, language: i18n.language })
  useDocumentTitle(t('website:pricing.title'))
  const saving = bestSaving(plans)
  const free = plans?.find((plan) => plan.price?.amountMinor === 0)

  return (
    <PublicShell>
      <section className={`${landing.card} ${shell.panel}`} aria-labelledby="pricing-title">
        <header className={styles.head}>
          <h1 id="pricing-title" className={shell.title}>
            {t('website:pricing.titleLead')} <span className={landing.accent}>{t('website:pricing.titleAccent')}</span>
          </h1>
          <p className={styles.lead}>{t('website:pricing.text')}</p>
          <div className={styles.controls}>
            <div className={shell.tabs} role="tablist" aria-label={t('website:pricing.for')}>
              {ROLES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  role="tab"
                  aria-selected={entry === role}
                  className={entry === role ? `${shell.tab} ${shell.tabActive}` : shell.tab}
                  onClick={() => setParams(entry === 'recruiter' ? { for: 'recruiter' } : {}, { replace: true })}
                >
                  {t(`website:pricing.${entry}`)}
                </button>
              ))}
            </div>
            {saving > 0 && <IntervalSwitch value={interval} onChange={setInterval} saving={saving} />}
          </div>
        </header>

        {isError && <p className={shell.empty}>{t('website:loadError')}</p>}
        {!plans && !isError && (
          <SkeletonRegion className={styles.plans}>
            <Skeleton height={420} />
            <Skeleton height={420} />
          </SkeletonRegion>
        )}
        {plans && (
          <div className={styles.plans} role="tabpanel">
            {plans.map((plan) => {
              const paid = plan.price?.amountMinor > 0
              return (
                <article key={plan.key} className={cx(styles.plan, paid && styles.featured)} data-plan={plan.key}>
                  <div className={styles.planHead}>
                    <h2 className={styles.planName}>{plan.name}</h2>
                    {paid && <span className={styles.recommended}>{t('website:pricing.recommended')}</span>}
                  </div>
                  <PlanPrice plan={plan} interval={interval} size="lg" />
                  <Link to={SIGN_UP[role]} className={cx(styles.cta, paid && styles.ctaPrimary)}>
                    {t(paid ? 'website:pricing.startPaid' : 'website:pricing.startFree')}
                  </Link>
                  {paid && free && <p className={styles.everything}>{t('website:pricing.everything', { plan: free.name })}</p>}
                  <ul className={styles.features}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Icon as={Check} size={16} strokeWidth={2.2} className={styles.check} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        )}
        <ul className={styles.trust}>
          {TRUST.map((key) => (
            <li key={key}>
              <Icon as={Check} size={14} strokeWidth={2.4} className={styles.check} />
              {t(`website:pricing.trust.${key}`)}
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  )
}
