import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { CreditCard, ExternalLink, Sparkles } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCreatePortalSessionMutation, useGetSubscriptionQuery } from '@/features/candidate/billing/api.js'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import { useGetMyPaymentsQuery } from '@/features/payments/api.js'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import SettingsCard from '../components/SettingsCard.jsx'
import styles from './BillingSettingsPage.module.css'

/** The plan pill: active, retrying a failed renewal (M-120) or ending at period end (M-121). */
function planState(subscription) {
  if (!subscription?.paid) return 'free'
  if (subscription.cancelAtPeriodEnd) return 'ending'
  return subscription.retrying ? 'retrying' : 'active'
}
const STATE_TONE = { active: 'success', ending: 'warning', retrying: 'warning' }

/**
 * Settings > Billing (§3.10): the plan in the subscription's own currency (C14), its renewal or end date, the Stripe
 * Customer Portal for cancelling, cards and invoices (M-121), the Free upsell, and the payment history (M-122).
 */
export default function BillingSettingsPage() {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const errorText = useErrorText()
  const dispatch = useDispatch()
  const { plus } = usePlan()
  const { data: subscription } = useGetSubscriptionQuery()
  const { data: payments = [] } = useGetMyPaymentsQuery()
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

  const price = paid
    ? format.money(subscription.amountMinor, subscription.currency)
    : plus?.price && format.money(plus.price.amountMinor, plus.price.currency)
  return (
    <div className={styles.stack}>
      <SettingsCard title={t('page.planTitle')} description={t('page.planDescription')}>
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
            {state === 'retrying' && <p className={styles.planMeta}>{t('page.retrying')}</p>}
          </div>
          <div className={styles.actions}>
            {subscription && (
              <Button variant="outline" loading={opening} rightIcon={<Icon as={ExternalLink} size={13} />} onClick={openPortal}>
                {t('page.manage')}
              </Button>
            )}
            {!paid && plus && (
              <Button leftIcon={<Icon as={Sparkles} size={14} />} onClick={() => dispatch(openUpgrade())}>
                {t('upgradeTo', { plan: plus.name })}
              </Button>
            )}
          </div>
        </div>
        <div role="alert">{portalError && <p className={styles.failure}>{errorText.code(portalError)}</p>}</div>
      </SettingsCard>

      <SettingsCard title={t('page.historyTitle')} description={t('page.historyDescription')}>
        <div className={styles.history}>
          {payments.length > 0 ? (
            <PaymentsTable payments={payments} />
          ) : (
            <EmptyState icon={CreditCard} title={t('page.emptyTitle')} description={t('page.emptyDescription')} />
          )}
        </div>
      </SettingsCard>
    </div>
  )
}
