import { useTranslation } from 'react-i18next'
import { CreditCard } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useGetMyPaymentsQuery } from '@/features/payments/api.js'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import PlanCard from '@/features/payments/components/PlanCard.jsx'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import styles from './BillingPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

/**
 * Settings > Billing: Recruiter Plus (§3.22: the Free upsell, or its status, renewal date and the Stripe Customer
 * Portal) and the recruiter's own payments with their Stripe receipts (M-122, A: recruiter A33).
 */
export default function BillingPage() {
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('page', 'billing')
  const { t } = useTranslation('billing')
  const { data: payments = [] } = useGetMyPaymentsQuery()

  return (
    <SettingsLayout>
      <SettingsCard title={t('page.planTitle')}>
        <p className={styles.lead}>{t('recruiter.planDescription')}</p>
        <PlanCard />
      </SettingsCard>
      <SettingsCard title={t('page.historyTitle')}>
        <p className={styles.lead}>{t('recruiter.lead')}</p>
        <div className={styles.table}>
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title={t('page.emptyTitle')} description={t('recruiter.emptyDescription')} />
          ) : (
            <PaymentsTable payments={payments} />
          )}
        </div>
      </SettingsCard>
    </SettingsLayout>
  )
}
