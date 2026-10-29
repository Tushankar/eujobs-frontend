import DataTable from '@/components/common/DataTable.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button } from '@/components/ui'
import {
  PAYER_ROLE_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_STATUS,
  formatMoney,
  formatPaymentDate,
} from '../data/payments.js'
import styles from './PaymentsTable.module.css'

/**
 * Payment list used by every role's billing view. `showPayer` adds the payer column (admin);
 * `onView(payment)` adds a Details button per row.
 */
export default function PaymentsTable({ payments, showPayer = false, onView }) {
  const columns = [
    { key: 'reference', header: 'Reference', render: (payment) => <span className={styles.reference}>{payment.reference}</span> },
    ...(showPayer
      ? [
          {
            key: 'payer',
            header: 'Payer',
            render: (payment) => (
              <>
                <span className={styles.strong}>{payment.payerName}</span>
                <span className={styles.muted}>{PAYER_ROLE_LABEL[payment.payerRole]}</span>
              </>
            ),
          },
        ]
      : []),
    { key: 'item', header: 'Item', render: (payment) => <span className={styles.strong}>{payment.itemName}</span> },
    { key: 'kind', header: 'Type', render: (payment) => <span className={styles.muted}>{PAYMENT_KIND_LABEL[payment.kind]}</span> },
    { key: 'amount', header: 'Amount', render: (payment) => <span className={styles.strong}>{formatMoney(payment.amount)}</span> },
    { key: 'method', header: 'Method', render: (payment) => <span className={styles.muted}>{`${payment.method.brand} •••• ${payment.method.last4}`}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => <PillBadge tone={PAYMENT_STATUS[payment.status].tone}>{PAYMENT_STATUS[payment.status].label}</PillBadge>,
    },
    { key: 'date', header: 'Date', render: (payment) => <span className={styles.muted}>{formatPaymentDate(payment.at)}</span> },
    ...(onView
      ? [
          {
            key: 'view',
            header: <span className="sr-only">Details</span>,
            render: (payment) => (
              <Button variant="ghost" size="sm" onClick={() => onView(payment)} aria-label={`Details for ${payment.reference}`}>
                Details
              </Button>
            ),
          },
        ]
      : []),
  ]

  return <DataTable caption="Payments" columns={columns} rows={payments} getRowKey={(payment) => payment.id} />
}
