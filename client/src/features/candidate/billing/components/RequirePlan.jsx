import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useMatches } from 'react-router-dom'
import { Check, Crown, X } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { lacksEntitlement, usePlan } from '../usePlan.js'
import { cx } from '@/utils/cx.js'
import styles from './RequirePlan.module.css'

/**
 * Route layout for paid pages of candidates and recruiters (M-118, A: shared §8.3, §3.22): the entitlement comes from the
 * route's `handle.entitlement`.
 * With it the pages render; without it, the upgrade card. The server enforces the same rule (402 PLAN_REQUIRED).
 */
export default function RequirePlan() {
  const { me } = usePreferences()
  const entitlement = useMatches().findLast((match) => match.handle?.entitlement)?.handle.entitlement
  return lacksEntitlement(me, entitlement, [me?.role]) ? <PlanGate entitlement={entitlement} /> : <Outlet />
}

/** One plan column of the gate: name, price, what it includes and, crossed out, what it does not (`missing`). */
function PlanColumn({ plan, badge, lead, featured, missing = [], children }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  return (
    <section className={cx(styles.plan, featured && styles.featured)} data-plan={plan.key}>
      <div className={styles.planHead}>
        <h2 className={styles.planName}>{plan.name}</h2>
        {badge}
      </div>
      {plan.price && (
        <p className={styles.price}>
          {format.money(plan.price.amountMinor, plan.price.currency)} <span>{t('perMonth')}</span>
        </p>
      )}
      {lead && <p className={styles.lead}>{lead}</p>}
      <ul className={styles.features}>
        {plan.features.map((feature) => (
          <li key={feature}>
            <Icon as={Check} size={16} strokeWidth={2.2} className={styles.check} /> {feature}
          </li>
        ))}
        {missing.map((feature) => (
          <li key={feature} className={styles.missing} data-missing>
            <Icon as={X} size={16} strokeWidth={2.2} className={styles.cross} /> {feature}
            <span className="sr-only"> · {t('gate.notIncluded')}</span>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>{children}</div>
    </section>
  )
}

/** The upgrade page of a locked feature: the role's Free plan beside its paid plan, priced like Checkout. */
export function PlanGate({ entitlement }) {
  const { t } = useTranslation('billing')
  const { me } = usePreferences()
  const { plus, free, item, loading } = usePlan()
  const [checkingOut, setCheckingOut] = useState(false)

  return (
    <>
      <PageTitle eyebrow={loading ? <Skeleton width={48} height={8} /> : plus?.name} title={t(`gate.${entitlement}.title`)} description={t(`gate.${entitlement}.lead`)} />
      {loading && (
        <SkeletonRegion className={styles.plans}>
          {[false, true].map((featured) => (
            <div key={String(featured)} className={cx(styles.plan, featured && styles.featured)}>
              <div className={styles.planHead}>
                <Skeleton width={72} height={16} />
                <Skeleton shape="pill" width={96} />
              </div>
              <p className={styles.price}>
                <Skeleton width={110} height={26} />
              </p>
              <div className={cx(styles.features, styles.featuresSkeleton)}>
                {[180, 220, 160, 150, 200, 190, 230].map((width) => (
                  <Skeleton key={width} width={width} />
                ))}
              </div>
              <div className={styles.actions}>
                <Skeleton shape="pill" width="100%" height={40} />
              </div>
            </div>
          ))}
        </SkeletonRegion>
      )}
      <div className={styles.plans} data-plan-gate={entitlement}>
        {free && (
          <PlanColumn plan={free} missing={plus?.features} badge={<span className={styles.current}>{t('gate.currentPlan')}</span>}>
            <Button variant="outline" fullWidth disabled>
              {t('gate.currentPlan')}
            </Button>
          </PlanColumn>
        )}
        {plus && (
          <PlanColumn
            plan={plus}
            featured
            lead={free && t('gate.everything', { plan: free.name })}
            badge={
              <span className={styles.badge}>
                <Icon as={Crown} size={12} strokeWidth={2.2} /> {t('enums:planKey.plus')}
              </span>
            }
          >
            <Button fullWidth onClick={() => setCheckingOut(true)}>
              {t('upgradeTo', { plan: plus.name })}
            </Button>
            <Button as={Link} to={`/${me.role}/settings/billing`} variant="ghost" fullWidth>
              {t('manageBilling')}
            </Button>
          </PlanColumn>
        )}
      </div>
      <CheckoutDialog item={checkingOut ? item : null} onClose={() => setCheckingOut(false)} />
    </>
  )
}
