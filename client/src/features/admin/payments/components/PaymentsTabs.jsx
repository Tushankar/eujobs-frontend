import { useTranslation } from 'react-i18next'
import { Receipt, Tags } from 'lucide-react'
import QueueTabs from '@/features/admin/moderation/components/QueueTabs.jsx'

/** Admin › Payments: the payment rows and the plans (2026-11-13), each a route. */
export default function PaymentsTabs({ value, payments, plans }) {
  const { t } = useTranslation('adminPayments')
  return (
    <QueueTabs
      value={value}
      tabs={[
        { id: 'payments', label: t('tabs.payments'), icon: Receipt, count: payments ?? 0, loading: payments === undefined, to: '/admin/payments' },
        { id: 'plans', label: t('tabs.plans'), icon: Tags, count: plans ?? 0, loading: plans === undefined, to: '/admin/payments/plans' },
      ]}
    />
  )
}
