import { CreditCard } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import { usePayments } from '@/features/payments/hooks/usePayments.js'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import styles from './BillingPage.module.css'

/** Settings > Billing: the course payments made from this workspace, paid or declined, kept on this device. */
export default function BillingPage() {
  const { payments } = usePayments('recruiter')

  return (
    <SettingsLayout>
      <SettingsCard title="Payment history">
        <p className={styles.lead}>Every course payment from this workspace. The checkout is a demo, so nothing is actually charged.</p>
        <div className={styles.table}>
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Paid courses you buy in Recruiter learning appear here." />
          ) : (
            <PaymentsTable payments={payments} />
          )}
        </div>
      </SettingsCard>
    </SettingsLayout>
  )
}
