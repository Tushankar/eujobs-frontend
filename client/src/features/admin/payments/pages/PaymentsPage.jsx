import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Download, Repeat, Search, Wallet } from 'lucide-react'
import { Button, Icon, Modal, SelectField, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useAuditLog } from '@/features/admin/audit-logs/hooks/useAuditLog.js'
import { formatDateTime } from '@/features/admin/audit-logs/utils/formatDate.js'
import {
  PAYER_ROLE_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_STATUS,
  formatMoney,
} from '@/features/payments/data/payments.js'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import { usePayments } from '@/features/payments/hooks/usePayments.js'
import { downloadCsv } from '@/utils/downloadCsv.js'
import styles from './PaymentsPage.module.css'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
]
const PAYER_OPTIONS = [
  { value: 'all', label: 'All payers' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'recruiter', label: 'Recruiters' },
]
const KIND_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'course', label: 'Courses' },
  { value: 'subscription', label: 'Subscriptions' },
]

/**
 * Payments: every payment made through the demo checkout by candidates and recruiters (paid and declined), plus the
 * sample payments. Search and filters narrow the table; "Export payments" saves the matching rows as a CSV.
 */
export default function PaymentsPage() {
  const { payments } = usePayments()
  const { record } = useAuditLog()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [payer, setPayer] = useState('all')
  const [kind, setKind] = useState('all')
  const [selected, setSelected] = useState(null)
  const [exportStatus, setExportStatus] = useState('')

  const paid = payments.filter((payment) => payment.status === 'paid')
  const collected = paid.reduce((total, payment) => total + payment.amount, 0)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return payments.filter(
      (payment) =>
        (status === 'all' || payment.status === status) &&
        (payer === 'all' || payment.payerRole === payer) &&
        (kind === 'all' || payment.kind === kind) &&
        (!needle || [payment.reference, payment.payerName, payment.itemName].some((text) => text.toLowerCase().includes(needle))),
    )
  }, [payments, query, status, payer, kind])

  function handleExport() {
    downloadCsv(
      [
        ['Reference', 'Date', 'Payer', 'Role', 'Item', 'Type', 'Amount (GBP)', 'Method', 'Status', 'Failure reason'],
        ...rows.map((payment) => [
          payment.reference,
          payment.at,
          payment.payerName,
          PAYER_ROLE_LABEL[payment.payerRole],
          payment.itemName,
          PAYMENT_KIND_LABEL[payment.kind],
          payment.amount.toFixed(2),
          `${payment.method.brand} ending ${payment.method.last4}`,
          PAYMENT_STATUS[payment.status].label,
          payment.failureReason ?? '',
        ]),
      ],
      'payments.csv',
    )
    record({
      title: 'Payments exported',
      category: 'Reports',
      detail: `${rows.length} ${rows.length === 1 ? 'payment was' : 'payments were'} exported as payments.csv in the browser and saved to this device. Nothing was uploaded.`,
    })
    setExportStatus('payments.csv was generated in your browser and saved to this device. Nothing was uploaded.')
  }

  return (
    <>
      <PageTitle
        title="Every payment, in one place."
        description="Track what candidates and recruiters pay for, and see which attempts did not go through."
        actions={
          <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={handleExport} disabled={rows.length === 0}>
            Export payments
          </Button>
        }
      />
      <div role="status">{exportStatus && <p className={styles.status}>{exportStatus}</p>}</div>

      <div className={styles.stats}>
        <StatCard label="Collected" value={formatMoney(collected)} caption="From paid payments, in GBP" icon={Wallet} />
        <StatCard label="Successful payments" value={paid.length} caption="Courses and subscriptions" icon={CircleCheck} />
        <StatCard label="Failed payments" value={payments.length - paid.length} caption="Declined at checkout" icon={CircleAlert} />
        <StatCard
          label="Subscriptions"
          value={paid.filter((payment) => payment.kind === 'subscription').length}
          caption="Paid AI Matches Plus plans"
          icon={Repeat}
        />
      </div>

      <div className={styles.filters}>
        <TextField
          className={styles.search}
          type="search"
          aria-label="Search payments"
          placeholder="Search reference, payer or item"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField className={styles.select} aria-label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={(event) => setStatus(event.target.value)} />
        <SelectField className={styles.select} aria-label="Filter by payer" options={PAYER_OPTIONS} value={payer} onChange={(event) => setPayer(event.target.value)} />
        <SelectField className={styles.select} aria-label="Filter by type" options={KIND_OPTIONS} value={kind} onChange={(event) => setKind(event.target.value)} />
      </div>

      <div className={styles.results}>
        {rows.length === 0 ? (
          <EmptyState icon={Search} title="No payments match" description="Try a different search, or choose another status, payer or type." />
        ) : (
          <PaymentsTable payments={rows} showPayer onView={setSelected} />
        )}
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Payment ${selected.reference}` : ''}
        width={480}
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected && (
          <dl className={styles.details}>
            <div className={styles.detail}>
              <dt>Status</dt>
              <dd>
                <PillBadge tone={PAYMENT_STATUS[selected.status].tone}>{PAYMENT_STATUS[selected.status].label}</PillBadge>
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Payer</dt>
              <dd>
                {selected.payerName} · {PAYER_ROLE_LABEL[selected.payerRole]}
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Item</dt>
              <dd>
                {selected.itemName} · {PAYMENT_KIND_LABEL[selected.kind]}
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Amount</dt>
              <dd>{formatMoney(selected.amount)}</dd>
            </div>
            <div className={styles.detail}>
              <dt>Method</dt>
              <dd>{`${selected.method.brand} •••• ${selected.method.last4}`}</dd>
            </div>
            <div className={styles.detail}>
              <dt>Date</dt>
              <dd>{formatDateTime(selected.at)}</dd>
            </div>
            {selected.failureReason && (
              <div className={styles.detail}>
                <dt>Failure reason</dt>
                <dd>{selected.failureReason}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </>
  )
}
