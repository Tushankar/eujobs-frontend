import { useTranslation } from 'react-i18next'
import { CreditCard } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useGetMyPaymentsQuery } from '@/features/payments/api.js'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import PlanCard from '@/features/payments/components/PlanCard.jsx'
import SettingsCard from '../components/SettingsCard.jsx'
import styles from './BillingSettingsPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

/**
 * Settings > Billing (§3.10): the plan (its currency, renewal or end date, the Stripe Customer Portal and the Free
 * upsell; M-121) and the payment history (M-122).
 */
export default function BillingSettingsPage() {
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('page', 'billing')
  const { t } = useTranslation('billing')
  const { data: payments = [] } = useGetMyPaymentsQuery()

  return (
    <div className={styles.stack}>
      <SettingsCard title={t('page.planTitle')} description={t('page.planDescription')}>
        <PlanCard />
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
