import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Building2, CalendarClock, Check, FileText, Users, Workflow } from 'lucide-react'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import IntervalSwitch from '@/features/payments/components/IntervalSwitch.jsx'
import { bestSaving } from '@/features/payments/bestSaving.js'
import PlanPrice from '@/features/payments/components/PlanPrice.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetLandingQuery, useGetPublicPlansQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import landing from '../components/landing/Landing.module.css'
import shell from '../components/PublicShell.module.css'
import pricing from './PricingPage.module.css'
import styles from './AgenciesPage.module.css'

const FEATURES = [
  { key: 'clients', icon: Building2 },
  { key: 'books', icon: Users },
  { key: 'contracts', icon: FileText },
  { key: 'placements', icon: CalendarClock },
  { key: 'hiring', icon: Workflow },
]
const SIGN_UP = '/agencies/signup'
const SIGN_IN = '/agencies/login'

/**
 * /agencies (2026-11-20): what an agency gets on EU Jobs, its live figures (open agency jobs, agencies on the site;
 * shown only when there are some) and the Agency plans of GET /plans, with sign-up and sign-in.
 */
export default function AgenciesPage() {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const [interval, setInterval] = useState('month')
  const { data } = useGetLandingQuery(i18n.language)
  const { currentData: plans, isError } = useGetPublicPlansQuery({ role: 'agency', language: i18n.language })
  useDocumentTitle(t('website:agencies.documentTitle'))
  const saving = bestSaving(plans)
  const free = plans?.find((plan) => plan.price?.amountMinor === 0)
  const figures = data?.agencies
  const live = [
    figures?.jobs > 0 && t('website:agencies.liveJobs', { count: figures.jobs, value: format.number(figures.jobs) }),
    figures?.accounts > 0 && t('website:agencies.liveAgencies', { count: figures.accounts, value: format.number(figures.accounts) }),
  ].filter(Boolean)

  return (
    <PublicShell>
      <section className={`${landing.card} ${shell.panel} ${styles.hero}`} aria-labelledby="agencies-title">
        <p className={styles.eyebrow}>{t('website:agencies.eyebrow')}</p>
        <h1 id="agencies-title" className={shell.title}>
          {t('website:agencies.titleLead')} <span className={landing.accent}>{t('website:agencies.titleAccent')}</span>
        </h1>
        <p className={styles.lead}>{t('website:agencies.lead')}</p>
        <div className={styles.actions}>
          <Link to={SIGN_UP} className={cx(pricing.cta, pricing.ctaPrimary, styles.action)} data-agency-signup>
            {t('website:agencies.signUp')}
          </Link>
          <Link to={SIGN_IN} className={cx(pricing.cta, styles.action)}>
            {t('website:agencies.signIn')}
          </Link>
        </div>
        {live.length > 0 && (
          <p className={styles.live} data-agency-figures>
            {live.join(' · ')}
          </p>
        )}
      </section>

      <section className={`${landing.card} ${shell.panel}`} aria-labelledby="agencies-how">
        <h2 id="agencies-how" className={styles.sectionTitle}>
          {t('website:agencies.how.title')}
        </h2>
        <ol className={styles.steps}>
          {t('website:agencies.how.steps', { returnObjects: true }).map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.number}>{index + 1}</span>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepText}>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${landing.card} ${shell.panel}`} aria-labelledby="agencies-features">
        <h2 id="agencies-features" className={styles.sectionTitle}>
          {t('website:agencies.features.title')}
        </h2>
        <ul className={styles.features}>
          {FEATURES.map(({ key, icon }) => (
            <li key={key} className={styles.feature}>
              <Icon as={icon} size={20} className={styles.featureIcon} />
              <span className={styles.featureText}>
                <span className={styles.featureTitle}>{t(`website:agencies.features.${key}.title`)}</span>
                <span className={styles.featureBody}>{t(`website:agencies.features.${key}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${landing.card} ${shell.panel}`} aria-labelledby="agencies-plans">
        <header className={pricing.head}>
          <h2 id="agencies-plans" className={styles.sectionTitle}>
            {t('website:agencies.plans')}
          </h2>
          {saving > 0 && <IntervalSwitch value={interval} onChange={setInterval} saving={saving} />}
        </header>
        {isError && <p className={shell.empty}>{t('website:loadError')}</p>}
        {!plans && !isError && (
          <SkeletonRegion className={pricing.plans}>
            <Skeleton height={380} />
            <Skeleton height={380} />
          </SkeletonRegion>
        )}
        {plans && (
          <div className={pricing.plans}>
            {plans.map((plan) => {
              const paid = plan.price?.amountMinor > 0
              return (
                <article key={plan.key} className={cx(pricing.plan, paid && pricing.featured)} data-plan={plan.key}>
                  <div className={pricing.planHead}>
                    <h3 className={pricing.planName}>{plan.name}</h3>
                    {paid && <span className={pricing.recommended}>{t('website:pricing.recommended')}</span>}
                  </div>
                  <PlanPrice plan={plan} interval={interval} size="lg" />
                  <Link to={SIGN_UP} className={cx(pricing.cta, paid && pricing.ctaPrimary)}>
                    {t(paid ? 'website:pricing.startPaid' : 'website:pricing.startFree')}
                  </Link>
                  {paid && free && <p className={pricing.everything}>{t('website:pricing.everything', { plan: free.name })}</p>}
                  <ul className={pricing.features}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Icon as={Check} size={16} strokeWidth={2.2} className={pricing.check} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </PublicShell>
  )
}
