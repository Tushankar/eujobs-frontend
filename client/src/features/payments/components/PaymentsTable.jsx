import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './PaymentsTable.module.css'

const STATUS_TONE = { paid: 'success', failed: 'danger', refunded: 'neutral' }

// Card brands are names, not words: "visa" → "Visa".
const brandName = (brand) => brand.charAt(0).toUpperCase() + brand.slice(1)

/**
 * Payment rows of every role's billing view (M-122): amounts in each row's own currency (M-130), the Stripe receipt
 * or hosted-invoice link (C12). `showPayer` adds the payer column (admin); `onView(payment)` adds a Details button.
 */
export default function PaymentsTable({ payments, showPayer = false, onView }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const method = ({ method: used }) => {
    if (!used) return '—'
    if (used.type === 'card' && used.last4) return `${brandName(used.brand)} •••• ${used.last4}`
    return t(`methods.${used.type === 'link' ? 'link' : 'other'}`)
  }
  const columns = [
    { key: 'reference', header: t('table.reference'), render: (payment) => <span className={styles.reference}>{payment.reference}</span> },
    ...(showPayer
      ? [
          {
            key: 'payer',
            header: t('table.payer'),
            render: (payment) => (
              <>
                <span className={styles.strong}>{payment.payerName}</span>
                <span className={styles.muted}>{t(`enums:role.${payment.payerRole}`)}</span>
              </>
            ),
          },
        ]
      : []),
    { key: 'item', header: t('table.item'), render: (payment) => <span className={styles.strong}>{payment.itemName}</span> },
    { key: 'kind', header: t('table.type'), render: (payment) => <span className={styles.muted}>{t(`enums:paymentKind.${payment.kind}`)}</span> },
    {
      key: 'amount',
      header: t('table.amount'),
      render: (payment) => <span className={styles.strong}>{format.money(payment.amountMinor, payment.currency)}</span>,
    },
    { key: 'method', header: t('table.method'), render: (payment) => <span className={styles.muted}>{method(payment)}</span> },
    {
      key: 'status',
      header: t('table.status'),
      render: (payment) => (
        <PillBadge tone={STATUS_TONE[payment.status]} data-payment-status={payment.status}>
          {t(`enums:paymentStatus.${payment.status}`)}
        </PillBadge>
      ),
    },
    { key: 'date', header: t('table.date'), render: (payment) => <span className={styles.muted}>{format.date(payment.paidAt)}</span> },
    {
      key: 'receipt',
      header: <span className="sr-only">{t('table.receipt')}</span>,
      render: (payment) =>
        payment.receiptUrl && (
          <a className={styles.receipt} href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" aria-label={t('table.receiptFor', { reference: payment.reference })}>
            {t('table.receipt')}
            <Icon as={ExternalLink} size={12} />
          </a>
        ),
    },
    ...(onView
      ? [
          {
            key: 'view',
            header: <span className="sr-only">{t('table.details')}</span>,
            render: (payment) => (
              <Button variant="ghost" size="sm" onClick={() => onView(payment)} aria-label={t('table.detailsFor', { reference: payment.reference })}>
                {t('table.details')}
              </Button>
            ),
          },
        ]
      : []),
  ]

  return <DataTable caption={t('table.caption')} columns={columns} rows={payments} getRowKey={(payment) => payment.id} />
}
