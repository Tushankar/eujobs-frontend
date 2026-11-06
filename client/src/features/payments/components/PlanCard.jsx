import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { ExternalLink } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCreatePortalSessionMutation, useGetSubscriptionQuery } from '@/features/candidate/billing/api.js'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import styles from './PlanCard.module.css'
import PlanFeatures from './PlanFeatures.jsx'

/** The plan pill: active, retrying a failed renewal (M-120) or ending at period end (M-121). */
function planState(subscription) {
  if (!subscription?.paid) return 'free'
  if (subscription.cancelAtPeriodEnd) return 'ending'
  return subscription.retrying ? 'retrying' : 'active'
}
const STATE_TONE = { active: 'success', ending: 'warning', retrying: 'warning' }

/**
 * Billing's plan row for candidates (Plus) and recruiters (Recruiter Plus, §3.22): the plan in the subscription's own
 * currency (C14), its renewal or end date, the Stripe Customer Portal (M-121) and the Free upsell.
 */
export default function PlanCard() {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const errorText = useErrorText()
  const dispatch = useDispatch()
  const { me } = usePreferences()
  const { plus, loading: planLoading } = usePlan()
  const { data: subscription, isLoading } = useGetSubscriptionQuery(me.role)
  const [createPortal, { isLoading: opening, error: portalError }] = useCreatePortalSessionMutation()
  const state = planState(subscription)
  const paid = state !== 'free'

  async function openPortal() {
    try {
      const { url } = await createPortal().unwrap()
      window.location.assign(url)
    } catch {
      // The error is shown under the plan.
    }
  }

  // The plan row while the subscription loads, so Free and its upsell never flash for a paying user.
  if (isLoading || planLoading) {
    return (
      <SkeletonRegion className={styles.plan}>
        <div>
          <p className={styles.planName}>
            <Skeleton width={120} height={16} />
          </p>
          <p className={styles.planMeta}>
            <Skeleton width={240} />
          </p>
        </div>
        <Skeleton shape="pill" width={150} height={40} />
      </SkeletonRegion>
    )
  }

  const price = paid
    ? format.money(subscription.amountMinor, subscription.currency)
    : plus?.price && format.money(plus.price.amountMinor, plus.price.currency)
  return (
    <>
      <div className={styles.plan} data-billing-state={state}>
        <div>
          <p className={styles.planName}>
            {t(`enums:planKey.${paid ? subscription.planKey : 'free'}`)}
            {paid && (
              <PillBadge tone={STATE_TONE[state]} dot>
                {t(`status.${state}`)}
              </PillBadge>
            )}
          </p>
          {paid ? (
            <p className={styles.planMeta}>
              {price} {t('perMonth')} ·{' '}
              {t(state === 'ending' ? 'page.endsOn' : 'page.renewsOn', { date: format.date(subscription.currentPeriodEnd) })}
            </p>
          ) : (
            price && <p className={styles.planMeta}>{t('page.upsell', { plan: plus.name, price })}</p>
          )}
          {state === 'retrying' && <p className={styles.planMeta}>{t('page.retrying', { plan: t(`enums:planKey.${subscription.planKey}`) })}</p>}
        </div>
        <div className={styles.actions}>
          {subscription && (
            <Button variant="outline" loading={opening} rightIcon={<Icon as={ExternalLink} size={13} />} onClick={openPortal}>
              {t('page.manage')}
            </Button>
          )}
          {!paid && plus && <Button onClick={() => dispatch(openUpgrade())}>{t('upgradeTo', { plan: plus.name })}</Button>}
        </div>
      </div>
      {/* P11d-Q9: what the paid plan includes, from its plan record. */}
      <PlanFeatures plan={plus} className={styles.features} />
      <div role="alert">{portalError && <p className={styles.failure}>{errorText.code(portalError)}</p>}</div>
    </>
  )
}
