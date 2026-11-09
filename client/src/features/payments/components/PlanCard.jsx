import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Crown, ExternalLink } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCreatePortalSessionMutation, useGetSubscriptionQuery } from '@/features/candidate/billing/api.js'
import { PlanColumn } from '@/features/candidate/billing/components/RequirePlan.jsx'
import gate from '@/features/candidate/billing/components/RequirePlan.module.css'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './PlanCard.module.css'

/** The plan pill: active, retrying a failed renewal (M-120) or ending at period end (M-121). */
function planState(subscription) {
  if (!subscription?.paid) return 'free'
  if (subscription.cancelAtPeriodEnd) return 'ending'
  return subscription.retrying ? 'retrying' : 'active'
}
const STATE_TONE = { active: 'success', ending: 'warning', retrying: 'warning' }

/**
 * Billing's plans for candidates (Free / Plus) and recruiters (Free / Recruiter Plus, §3.22), side by side like the
 * plan gate: the current one marked, the paid one in the subscription's own currency (C14) with its renewal or end
 * date and the Stripe Customer Portal (M-121), or the upgrade.
 */
export default function PlanCard() {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const errorText = useErrorText()
  const dispatch = useDispatch()
  const { me } = usePreferences()
  const { plus, free, loading: planLoading } = usePlan()
  const { data: subscription, isLoading } = useGetSubscriptionQuery(me.role)
  const [createPortal, { isLoading: opening, error: portalError }] = useCreatePortalSessionMutation()
  const state = planState(subscription)
  const paid = state !== 'free'

  async function openPortal() {
    try {
      const { url } = await createPortal().unwrap()
      window.location.assign(url)
    } catch {
      // The error is shown under the plans.
    }
  }

  // Both columns while the subscription loads, so Free and its upsell never flash for a paying user.
  if (isLoading || planLoading) {
    return (
      <SkeletonRegion className={styles.plans}>
        {[false, true].map((featured) => (
          <div key={String(featured)} className={cx(gate.plan, featured && gate.featured)}>
            <div className={gate.planHead}>
              <Skeleton width={72} height={16} />
              <Skeleton shape="pill" width={96} />
            </div>
            <p className={gate.price}>
              <Skeleton width={110} height={26} />
            </p>
            <div className={cx(gate.features, gate.featuresSkeleton)}>
              {[180, 220, 160, 150].map((width) => (
                <Skeleton key={width} width={width} />
              ))}
            </div>
          </div>
        ))}
      </SkeletonRegion>
    )
  }

  const current = <span className={gate.current}>{t('gate.currentPlan')}</span>
  const meta = paid && (
    <>
      <p className={styles.meta}>{t(state === 'ending' ? 'page.endsOn' : 'page.renewsOn', { date: format.date(subscription.currentPeriodEnd) })}</p>
      {state === 'retrying' && <p className={styles.warning}>{t('page.retrying', { plan: plus?.name })}</p>}
    </>
  )
  return (
    <>
      <div className={styles.plans} data-billing-state={state}>
        {free && (
          // A subscriber sees Free in the subscription's currency too, never two currencies side by side.
          <PlanColumn plan={free} missing={plus?.features} badge={!paid && current} price={paid ? format.money(0, subscription.currency) : undefined}>
            {!paid && (
              <Button variant="outline" fullWidth disabled>
                {t('gate.currentPlan')}
              </Button>
            )}
          </PlanColumn>
        )}
        {plus && (
          <PlanColumn
            plan={plus}
            featured
            price={paid ? format.money(subscription.amountMinor, subscription.currency) : undefined}
            meta={meta}
            lead={free && t('gate.everything', { plan: free.name })}
            badge={
              <span className={styles.badges}>
                {paid && (
                  <PillBadge tone={STATE_TONE[state]} dot>
                    {t(`status.${state}`)}
                  </PillBadge>
                )}
                <span className={gate.badge}>
                  <Icon as={Crown} size={12} strokeWidth={2.2} /> {paid ? t('gate.currentPlan') : t(`enums:planKey.${plus.key}`)}
                </span>
              </span>
            }
          >
            {subscription && (
              <Button variant="outline" fullWidth loading={opening} rightIcon={<Icon as={ExternalLink} size={13} />} onClick={openPortal}>
                {t('page.manage')}
              </Button>
            )}
            {!paid && (
              <Button fullWidth onClick={() => dispatch(openUpgrade())}>
                {t('upgradeTo', { plan: plus.name })}
              </Button>
            )}
          </PlanColumn>
        )}
      </div>
      <div role="alert">{portalError && <p className={styles.failure}>{errorText.code(portalError)}</p>}</div>
    </>
  )
}
