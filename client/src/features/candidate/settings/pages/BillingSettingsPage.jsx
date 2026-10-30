import { useState } from 'react'
import { CreditCard, Sparkles } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { PLANS, PLUS_CHECKOUT_ITEM } from '@/features/candidate/billing/data/subscription.js'
import { useSubscription } from '@/features/candidate/billing/hooks/useSubscription.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import { formatPaymentDate } from '@/features/payments/data/payments.js'
import { usePayments } from '@/features/payments/hooks/usePayments.js'
import SettingsCard from '../components/SettingsCard.jsx'
import styles from './BillingSettingsPage.module.css'

/** Settings > Billing: the candidate's plan (upgrade or cancel through the demo checkout) and their payment history. */
export default function BillingSettingsPage() {
  const { subscription, plan, isPlus, setPlan } = useSubscription()
  const { payments } = usePayments('candidate')
  const [checkingOut, setCheckingOut] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const current = PLANS[plan]

  function handleCancel() {
    setPlan('free')
    setCancelling(false)
  }

  return (
    <div className={styles.stack}>
      <SettingsCard title="Your plan" description="AI insights is part of AI Matches Plus. Plans are paid through a demo checkout and nothing is really charged.">
        <div className={styles.plan}>
          <div>
            <p className={styles.planName}>
              {current.name}
              <PillBadge tone="success" dot>
                Active
              </PillBadge>
            </p>
            <p className={styles.planMeta}>
              {current.price} {current.period}
              {subscription?.startedAt && ` · Active since ${formatPaymentDate(subscription.startedAt)}`}
            </p>
          </div>
          {isPlus ? (
            <Button variant="outline" onClick={() => setCancelling(true)}>
              Cancel plan
            </Button>
          ) : (
            <Button leftIcon={<Icon as={Sparkles} size={14} />} onClick={() => setCheckingOut(true)}>
              Upgrade to {PLANS.plus.name}
            </Button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Payment history" description="Courses and plans paid for through the demo checkout. Declined attempts are listed too.">
        <div className={styles.history}>
          {payments.length > 0 ? (
            <PaymentsTable payments={payments} />
          ) : (
            <EmptyState icon={CreditCard} title="No payments yet" description="Courses and plans you pay for appear here." />
          )}
        </div>
      </SettingsCard>

      <CheckoutDialog
        item={checkingOut ? PLUS_CHECKOUT_ITEM : null}
        payerRole="candidate"
        onPaid={(payment) => {
          setPlan('plus', payment.id)
          setCheckingOut(false)
        }}
        onClose={() => setCheckingOut(false)}
      />
      <ConfirmDialog
        open={cancelling}
        title={`Cancel ${PLANS.plus.name}?`}
        description="AI insights will be locked again. This demo makes no further charges either way."
        confirmLabel="Cancel plan"
        cancelLabel="Keep plan"
        tone="danger"
        onConfirm={handleCancel}
        onClose={() => setCancelling(false)}
      />
    </div>
  )
}
