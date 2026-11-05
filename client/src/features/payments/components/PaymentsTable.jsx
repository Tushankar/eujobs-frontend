import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './PaymentsTable.module.css'

const STATUS_TONE = { paid: 'success', failed: 'danger', refunded: 'neutral' }

// Card brands are names, not words: "visa" → "Visa".
const brandName = (brand) => brand.charAt(0).toUpperCase() + brand.slice(1)

/**
 * Payment rows of every role's billing view (M-122): amounts in each row's own currency (M-130), the Stripe receipt
 * or hosted-invoice link (C12). `showPayer` adds the payer column and `showSource` the seeded badge (admin); `onView(payment)` adds a Details button.
 */
export default function PaymentsTable({ payments, showPayer = false, showSource = false, onView, loading, busy }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const method = ({ method: used }) => {
    if (!used) return '—'
    if (used.type === 'card' && used.last4) return `${brandName(used.brand)} •••• ${used.last4}`
    return t(`methods.${used.type === 'link' ? 'link' : 'other'}`)
  }
  const columns = [
    {
      key: 'reference',
      header: t('table.reference'),
      skeleton: 'text',
      render: (payment) => (
        <>
          <span className={styles.reference}>{payment.reference}</span>
          {/* P10-Q5: seeded rows are marked on the admin page. */}
          {showSource && payment.source === 'seed' && <PillBadge data-payment-source="seed">{t('enums:paymentSource.seed')}</PillBadge>}
        </>
      ),
    },
    ...(showPayer
      ? [
          {
            key: 'payer',
            header: t('table.payer'),
            skeleton: 'title',
            render: (payment) => (
              <>
                <span className={cx(styles.strong, styles.nowrap)}>{payment.payerName}</span>
                <span className={styles.muted}>{t(`enums:role.${payment.payerRole}`)}</span>
              </>
            ),
          },
        ]
      : []),
    // Two-line cells (item / type, amount / method) keep the table to 7 columns, so no cell wraps in a narrow window.
    {
      key: 'item',
      header: t('table.item'),
      skeleton: 'title',
      render: (payment) => (
        <>
          <span className={styles.strong}>{payment.itemName}</span>
          <span className={styles.muted}>{t(`enums:paymentKind.${payment.kind}`)}</span>
        </>
      ),
    },
    {
      key: 'amount',
      header: t('table.amount'),
      skeleton: 'title',
      render: (payment) => (
        <>
          <span className={cx(styles.strong, styles.nowrap)}>{format.money(payment.amountMinor, payment.currency)}</span>
          <span className={cx(styles.muted, styles.nowrap)}>{method(payment)}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: t('table.status'),
      skeleton: 'pill',
      render: (payment) => (
        <PillBadge tone={STATUS_TONE[payment.status]} data-payment-status={payment.status}>
          {t(`enums:paymentStatus.${payment.status}`)}
        </PillBadge>
      ),
    },
    { key: 'date', header: t('table.date'), skeleton: 'text', render: (payment) => <span className={cx(styles.muted, styles.nowrap)}>{format.date(payment.paidAt)}</span> },
    // The receipt link and the Details button share one actions column (one column less to fit).
    {
      key: 'actions',
      header: <span className="sr-only">{[t('table.receipt'), onView && t('table.details')].filter(Boolean).join(', ')}</span>,
      render: (payment) => (
        <span className={styles.actions}>
          {payment.receiptUrl && (
            <a className={styles.receipt} href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" aria-label={t('table.receiptFor', { reference: payment.reference })}>
              {t('table.receipt')}
              <Icon as={ExternalLink} size={12} />
            </a>
          )}
          {onView && (
            <Button variant="ghost" size="sm" onClick={() => onView(payment)} aria-label={t('table.detailsFor', { reference: payment.reference })}>
              {t('table.details')}
            </Button>
          )}
        </span>
      ),
    },
  ]

  return <DataTable className={styles.table} caption={t('table.caption')} columns={columns} rows={payments} getRowKey={(payment) => payment.id} loading={loading} busy={busy} />
}
