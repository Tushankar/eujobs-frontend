import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CircleAlert, Download, Repeat, Search, TrendingUp, Wallet } from 'lucide-react'
import { can } from '@/app/permissions.js'
import { tableState } from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon, Modal, SelectField, TextField } from '@/components/ui'
import PaymentsTable from '@/features/payments/components/PaymentsTable.jsx'
import { useCountryOptions } from '@/lib/countries.js'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useMarkSeen } from '@/features/notifications/api.js'
import { useGetAdminPaymentQuery, useGetAdminPaymentsQuery, useGetPaymentStatsQuery } from '../api.js'
import styles from './PaymentsPage.module.css'

const STATUS_TONE = { paid: 'success', failed: 'danger', refunded: 'neutral' }
const MONEY_LINES = 3
const FILTERS = {
  status: ['paid', 'failed', 'refunded'],
  payer: ['candidate', 'recruiter'],
  kind: ['course', 'subscription'],
  source: ['stripe', 'seed'],
}
const ALL = { status: 'allStatuses', payer: 'allPayers', kind: 'allKinds', source: 'allSources', country: 'allCountries' }

/** U34: one line per currency, largest first, at most 3, then "+n more"; never summed across currencies (C15). */
function MoneyLines({ totals }) {
  const { t } = useTranslation('adminPayments')
  const format = useFormat()
  if (!totals?.length) return t('stats.none')
  return (
    <span className={styles.moneyLines}>
      {totals.slice(0, MONEY_LINES).map((entry) => (
        <span key={entry.currency}>{format.money(entry.amountMinor, entry.currency)}</span>
      ))}
      {totals.length > MONEY_LINES && <span className={styles.more}>{t('stats.more', { count: totals.length - MONEY_LINES })}</span>}
    </span>
  )
}

/** P11c-Q8: the MRR card's lines per role (Plus = candidates, Recruiter Plus = recruiters), each by currency. */
function RoleMoney({ mrr }) {
  const { t } = useTranslation('adminPayments')
  return (
    <span className={styles.roleMoney}>
      {['candidate', 'recruiter'].map((role) => (
        <span key={role} className={styles.roleGroup} data-mrr-role={role}>
          <span className={styles.roleLabel}>{t(`stats.role.${role}`)}</span>
          <MoneyLines totals={mrr[role]} />
        </span>
      ))}
    </span>
  )
}

/** M-123: the row with the subscription's status and period for a plan payment; a gone row says so (P11b-Q4). */
function PaymentDetails({ id, onClose }) {
  const { t } = useTranslation(['adminPayments', 'enums'])
  const format = useFormat()
  const { data: payment, isError } = useGetAdminPaymentQuery(id)
  useMarkSeen('payment', payment?.id)
  const subscription = payment?.subscription
  const rows = payment
    ? [
        ['status', <PillBadge key="status" tone={STATUS_TONE[payment.status]}>{t(`enums:paymentStatus.${payment.status}`)}</PillBadge>],
        ['payer', payment.payerName && `${payment.payerName} · ${t(`enums:role.${payment.payerRole}`)}`],
        ['payerCountry', payment.payerCountry && format.country(payment.payerCountry)],
        ['item', `${payment.itemName} · ${t(`enums:paymentKind.${payment.kind}`)}`],
        ['amount', format.money(payment.amountMinor, payment.currency)],
        ['method', payment.method?.last4 ? t('details.methodValue', { brand: payment.method.brand, last4: payment.method.last4 }) : payment.method?.type],
        ['date', format.dateTime(payment.paidAt)],
        ['invoicePeriod', payment.periodStart && t('details.periodValue', { start: format.date(payment.periodStart), end: format.date(payment.periodEnd) })],
        ['failureReason', payment.failureReason && t(`failureReason.${payment.failureReason}`, { defaultValue: payment.failureReason })],
        ['source', t(`enums:paymentSource.${payment.source}`)],
        ['receipt', payment.receiptUrl && <a key="receipt" href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">{t('details.openReceipt')}</a>],
        ['subscription', subscription && t(`subscriptionStatus.${subscription.status}`)],
        ['period', subscription?.currentPeriodStart && t('details.periodValue', { start: format.date(subscription.currentPeriodStart), end: format.date(subscription.currentPeriodEnd) })],
        ['renewal', subscription && [t(subscription.cancelAtPeriodEnd ? 'details.endsAtPeriodEnd' : 'details.renews'), subscription.retrying && t('details.retrying')].filter(Boolean).join(' · ')],
      ].filter(([, value]) => value)
    : []
  return (
    <Modal
      open
      onClose={onClose}
      title={payment ? t('details.title', { reference: payment.reference }) : ''}
      width={480}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('details.close')}
        </Button>
      }
    >
      {isError && <NoticeBanner>{t('notifications:unavailable')}</NoticeBanner>}
      <dl className={styles.details}>
        {rows.map(([key, value]) => (
          <div key={key} className={styles.detail} data-detail={key}>
            <dt>{t(`details.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

/**
 * Admin › Payments (M-122, M-123, P10-Q5 … Q7): every payment row (Stripe and seeded) of candidates and recruiters,
 * server-paginated (M-206), with search, status, payer, type, source and payer-country filters; all-time cards that
 * follow only the country filter; details with the subscription status and period; an audited CSV export.
 */
export default function PaymentsPage() {
  const { t } = useTranslation(['adminPayments', 'enums'])
  const errorText = useErrorText()
  const { me } = usePreferences()
  const countries = useCountryOptions().filter((country) => !country.isRemote)
  const { params, setFilter, search, setSearch, clearFilters } = useUrlFilters()
  // P11b-Q9: /admin/payments/:paymentId opens that payment's details; the list keeps its filters.
  // (the layout remounts a page when its path changes, so View keeps local state; closing a linked payment returns to
  // the list's URL)
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [selected, setSelected] = useState(paymentId ?? null)
  const closeDetails = () => {
    setSelected(null)
    if (paymentId) navigate({ pathname: '/admin/payments', search: location.search }, { replace: true })
  }
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const filters = Object.fromEntries(['q', ...Object.keys(FILTERS), 'country'].map((name) => [name, params.get(name) ?? '']))
  const query = { page: Number(params.get('page')) || 1, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }
  const result = useGetAdminPaymentsQuery(query, { refetchOnMountOrArgChange: true })
  const { data, isSuccess } = result
  const table = tableState(result, data?.items ?? [])
  const { data: stats } = useGetPaymentStatsQuery(filters.country ? { country: filters.country } : {}, { refetchOnMountOrArgChange: true })
  const format = useFormat()
  const byRole = (counts) => t('stats.byRole', { candidates: format.number(counts.candidate), recruiters: format.number(counts.recruiter) })

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      await downloadFromApi('/admin/payments/export', { ...query, page: undefined })
    } catch (error) {
      setExportError(errorText.code(error))
    } finally {
      setExporting(false)
    }
  }

  const optionLabel = (name, value) => {
    if (name === 'status') return t(`enums:paymentStatus.${value}`)
    if (name === 'source') return t(`enums:paymentSource.${value}`)
    return t(`filters.${name === 'payer' ? 'payers' : 'kinds'}.${value}`)
  }

  return (
    <>
      <PageTitle
        title={t('title')}
        description={t('description')}
        actions={
          can(me, 'reports.export') && (
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={exportCsv} loading={exporting} disabled={!data?.total}>
              {t('export')}
            </Button>
          )
        }
      />
      {exportError && (
        <p className={styles.error} role="alert">
          {exportError}
        </p>
      )}

      <div className={styles.stats}>
        <StatCard label={t('stats.collected')} value={stats && <MoneyLines totals={stats.collected} />} caption={t('stats.collectedCaption')} icon={Wallet} />
        {/* P11c-Q8: the plan cards split by role. */}
        <StatCard label={t('stats.activeSubscribers')} value={stats?.activeSubscribers.total ?? 0} caption={stats && byRole(stats.activeSubscribers)} icon={Repeat} />
        <StatCard label={t('stats.mrr')} value={stats && <RoleMoney mrr={stats.mrr} />} caption={t('stats.mrrCaption')} icon={TrendingUp} />
        <StatCard label={t('stats.failedRenewals')} value={stats?.failedRenewals.total ?? 0} caption={stats && byRole(stats.failedRenewals)} icon={CircleAlert} />
      </div>

      <div className={styles.filters}>
        <TextField
          className={styles.search}
          type="search"
          name="q"
          aria-label={t('filters.search')}
          placeholder={t('filters.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {[...Object.keys(FILTERS), 'country'].map((name) => (
          <SelectField
            key={name}
            name={name}
            className={styles.select}
            aria-label={t(`filters.${name}`)}
            value={filters[name]}
            onChange={(event) => setFilter(name, event.target.value)}
            options={[
              { value: '', label: t(`filters.${ALL[name]}`) },
              ...(name === 'country' ? countries.map((country) => ({ value: country.code, label: country.name })) : FILTERS[name].map((value) => ({ value, label: optionLabel(name, value) }))),
            ]}
          />
        ))}
      </div>

      <div className={styles.results}>
        {table.loading || data?.items.length > 0 ? (
          <>
            <PaymentsTable payments={data?.items ?? []} showPayer showSource onView={(payment) => setSelected(payment.id)} loading={table.loading} busy={table.busy} />
            {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => setFilter('page', String(next))} />}
          </>
        ) : (
          isSuccess && (
            <EmptyState
              icon={Search}
              title={t('empty')}
              description={t('emptyText')}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  {t('clear')}
                </Button>
              }
            />
          )
        )}
      </div>

      {selected && <PaymentDetails id={selected} onClose={closeDetails} />}
    </>
  )
}
