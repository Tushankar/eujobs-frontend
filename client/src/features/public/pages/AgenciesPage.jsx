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
// The paid plan's first lines in the hero's plan card; the full lists are in the plans section.
const HIGHLIGHTS = 4

/** The hero's compact plan card: Monthly/Yearly, each plan's price, the paid plan's first lines and Get started. */
function PlanSnapshot({ plans, interval, onInterval, saving }) {
  const { t } = useTranslation()
  const paid = plans?.find((plan) => plan.price?.amountMinor > 0)
  return (
    <aside className={styles.snapshot} aria-labelledby="agencies-snapshot" data-plan-snapshot>
      <div className={styles.snapshotHead}>
        <h2 id="agencies-snapshot" className={styles.snapshotTitle}>
          {t('website:agencies.plans')}
        </h2>
        {saving > 0 && <IntervalSwitch value={interval} onChange={onInterval} saving={saving} />}
      </div>
      {!plans ? (
        <SkeletonRegion className={styles.snapshotRows}>
          <Skeleton height={52} />
          <Skeleton height={52} />
          <Skeleton height={96} />
        </SkeletonRegion>
      ) : (
        <>
          <ul className={styles.snapshotRows}>
            {plans.map((plan) => (
              <li key={plan.key} className={cx(styles.snapshotRow, plan === paid && styles.snapshotPaid)}>
                <span className={styles.snapshotName}>{plan.name}</span>
                <PlanPrice plan={plan} interval={interval} className={styles.snapshotPrice} />
              </li>
            ))}
          </ul>
          {paid && (
            <>
              <p className={styles.snapshotWith}>{t('website:agencies.withPlan', { plan: paid.name })}</p>
              <ul className={styles.snapshotLines}>
                {paid.features.slice(0, HIGHLIGHTS).map((feature) => (
                  <li key={feature}>
                    <Icon as={Check} size={15} strokeWidth={2.4} className={styles.snapshotCheck} />
                    {feature}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link to={SIGN_UP} className={cx(pricing.cta, styles.gradientCta, styles.snapshotCta)}>
            {t('website:pricing.startPaid')}
          </Link>
          <a href="#agencies-plans" className={styles.snapshotCompare}>
            {t('website:agencies.compare')} ↓
          </a>
        </>
      )}
    </aside>
  )
}

/**
 * /agencies (2026-11-20; layout picked by the owner 2026-11-23): a navy brand-gradient hero with what an agency gets,
 * the sign-up and sign-in buttons, the live figures (open agency jobs, agencies on the site; only when there are some)
 * and a compact card of the Agency plans; then How it works beside What your agency gets; then the full plan cards
 * with every feature line, in two columns.
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
  // Without plans (none stored, or GET /plans failed) the hero keeps its copy and the plans section says so.
  const hasPlans = plans === undefined || plans.length > 0

  return (
    <PublicShell>
      <section className={cx(styles.hero, !(hasPlans && !isError) && styles.heroSingle)} aria-labelledby="agencies-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t('website:agencies.eyebrow')}</p>
          <h1 id="agencies-title" className={styles.title}>
            {t('website:agencies.titleLead')} <span className={styles.titleAccent}>{t('website:agencies.titleAccent')}</span>
          </h1>
          <p className={styles.lead}>{t('website:agencies.lead')}</p>
          <div className={styles.actions}>
            <Link to={SIGN_UP} className={styles.signUp} data-agency-signup>
              {t('website:agencies.signUp')}
              <span className={styles.signUpArrow} aria-hidden="true">
                ↗
              </span>
            </Link>
            <Link to={SIGN_IN} className={styles.signIn}>
              {t('website:agencies.signIn')}
            </Link>
          </div>
          {live.length > 0 && (
            <p className={styles.live} data-agency-figures>
              <span className={landing.liveDot} aria-hidden="true" />
              {live.join(' · ')}
            </p>
          )}
        </div>
        {hasPlans && !isError && <PlanSnapshot plans={plans} interval={interval} onInterval={setInterval} saving={saving} />}
      </section>

      <div className={`${landing.card} ${shell.panel} ${styles.about}`}>
        <section aria-labelledby="agencies-how">
          <h2 id="agencies-how" className={styles.sectionTitle}>
            {t('website:agencies.how.title')}
          </h2>
          <ol className={styles.steps}>
            {t('website:agencies.how.steps', { returnObjects: true }).map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.number}>{index + 1}</span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepBody}>{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="agencies-features">
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
      </div>

      <section id="agencies-plans" className={`${landing.card} ${shell.panel} ${landing.anchor}`} aria-labelledby="agencies-plans-title">
        <header className={styles.plansHead}>
          <h2 id="agencies-plans-title" className={styles.sectionTitle}>
            {t('website:agencies.plans')}
          </h2>
          {saving > 0 && <IntervalSwitch value={interval} onChange={setInterval} saving={saving} />}
        </header>
        {isError && <p className={shell.empty}>{t('website:loadError')}</p>}
        {plans?.length === 0 && <p className={shell.empty}>{t('website:agencies.plansEmpty')}</p>}
        {!plans && !isError && (
          <SkeletonRegion className={styles.plans}>
            <Skeleton height={300} />
            <Skeleton height={300} />
          </SkeletonRegion>
        )}
        {plans?.length > 0 && (
          <div className={styles.plans}>
            {plans.map((plan) => {
              const paid = plan.price?.amountMinor > 0
              return (
                <article key={plan.key} className={cx(pricing.plan, styles.plan, paid && pricing.featured)} data-plan={plan.key}>
                  <div className={pricing.planHead}>
                    <h3 className={pricing.planName}>{plan.name}</h3>
                    {paid && <span className={pricing.recommended}>{t('website:pricing.recommended')}</span>}
                  </div>
                  <div className={styles.planBuy}>
                    <PlanPrice plan={plan} interval={interval} size="lg" />
                    <Link to={SIGN_UP} className={cx(pricing.cta, styles.planCta, paid && styles.gradientCta)}>
                      {t(paid ? 'website:pricing.startPaid' : 'website:pricing.startFree')}
                    </Link>
                  </div>
                  {paid && free && <p className={pricing.everything}>{t('website:pricing.everything', { plan: free.name })}</p>}
                  <ul className={cx(pricing.features, styles.planFeatures)}>
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
