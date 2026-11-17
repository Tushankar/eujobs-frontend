import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { can } from '@/app/permissions.js'
import DataTable from '@/components/common/DataTable.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel, SelectField, Skeleton, SkeletonRegion } from '@/components/ui'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetAdminAiUsageQuery } from '../api.js'
import AiMatchingTabs from '../components/AiMatchingTabs.jsx'
import UsageSettings from '../components/UsageSettings.jsx'
import styles from './UsagePage.module.css'

/** The current UTC month and the eleven before it, newest first (YYYY-MM). */
function recentMonths() {
  const now = new Date()
  return Array.from({ length: 12 }, (_, back) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7))
}

/** USD with cents, or up to four decimals under one dollar so a few calls still show a cost. */
function useUsd() {
  const format = useFormat()
  return (value) => format.number(value, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < 1 ? 4 : 2 })
}

const compact = (format, value) => format.number(value, { notation: 'compact', maximumFractionDigits: 1 })

/** One provider: this month's estimated spend against its budget, with the calls and a link to the real billing page. */
function ProviderCard({ provider, data, billingUrl }) {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  const usd = useUsd()
  const share = data.share ?? 0
  const tone = data.paused ? 'danger' : share >= 0.8 ? 'warning' : data.budget ? 'success' : 'neutral'
  const status = data.paused ? 'paused' : share >= 0.8 ? 'near' : data.budget ? 'ok' : 'noBudget'
  return (
    <Panel padding={24} className={styles.provider} data-usage-provider={provider}>
      <div className={styles.providerHead}>
        <div>
          <h3 className={styles.providerName}>{t(`usage.providers.${provider}`)}</h3>
          <p className={styles.providerUse}>{t(`usage.providerUse.${provider}`)}</p>
        </div>
        <PillBadge tone={tone} dot data-usage-status={status}>
          {t(`usage.status.${status}`, { percent: Math.round(share * 100) })}
        </PillBadge>
      </div>
      <p className={styles.spend}>
        <strong data-usage-spend>{usd(data.spend)}</strong>
        <span>{data.budget ? t('usage.ofBudget', { budget: usd(data.budget) }) : t('usage.noBudget')}</span>
      </p>
      {data.budget > 0 && (
        <div className={styles.bar} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(share * 100))} aria-label={t('usage.budgetUsed')}>
          <span className={styles[tone]} style={{ width: `${Math.min(100, share * 100)}%` }} />
        </div>
      )}
      <p className={styles.counts}>
        {provider === 'openai'
          ? t('usage.openaiCounts', { calls: format.number(data.calls), input: compact(format, data.inputTokens), output: compact(format, data.outputTokens) })
          : t('usage.placesCounts', { calls: format.number(data.calls) })}
      </p>
      {data.unpriced && <p className={styles.unpriced}>{t('usage.unpriced')}</p>}
      <a className={styles.billing} href={billingUrl} target="_blank" rel="noreferrer">
        {t(`usage.billing.${provider}`)}
        <Icon as={ExternalLink} size={12} />
      </a>
    </Panel>
  )
}

function UsageSkeleton() {
  return (
    <SkeletonRegion>
      <div className={styles.providers}>
        {[0, 1].map((key) => (
          <Panel key={key} padding={24} className={styles.provider}>
            <Skeleton width={140} height={16} />
            <Skeleton width={120} height={28} />
            <Skeleton width="100%" height={8} />
            <Skeleton width={200} />
          </Panel>
        ))}
      </div>
    </SkeletonRegion>
  )
}

/**
 * Admin › AI & matching › Usage (owner 2026-11-17): what EU Jobs's OpenAI and Google Places calls cost this month,
 * estimated from its own counts and the admin's prices (the shared OpenAI key cannot read the real spend), each
 * against a budget that pauses the provider at 100 %. Also the features and users behind the cost, and the limits.
 */
export default function UsagePage() {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  const usd = useUsd()
  const { me } = usePreferences()
  const months = recentMonths()
  const [month, setMonth] = useState(months[0])
  const { data, isLoading, isFetching, isError } = useGetAdminAiUsageQuery(month, { refetchOnMountOrArgChange: true })
  const tokens = (row) =>
    row.provider === 'places' ? '—' : row.seconds > 0 && !row.inputTokens ? t('usage.seconds', { count: Math.round(row.seconds) }) : `${compact(format, row.inputTokens)} / ${compact(format, row.outputTokens)}`
  const cost = (row) => (row.cost === null ? <span className={styles.muted}>{t('usage.noPrice')}</span> : usd(row.cost))

  const breakdownColumns = [
    { key: 'kind', header: t('usage.columns.feature'), render: (row) => <span className={styles.strong}>{t([`usage.kinds.${row.kind}`, `enums:aiKind.${row.kind}`], { defaultValue: row.kind })}</span> },
    { key: 'model', header: t('usage.columns.model'), render: (row) => `${t(`usage.providers.${row.provider}`)} · ${row.model}` },
    { key: 'calls', header: t('usage.columns.calls'), render: (row) => format.number(row.calls) },
    { key: 'tokens', header: t('usage.columns.tokens'), render: tokens },
    { key: 'cost', header: t('usage.columns.cost'), render: cost },
  ]
  const userColumns = [
    {
      key: 'user',
      header: t('usage.columns.user'),
      render: (row) => (
        <span className={styles.user}>
          <span className={styles.strong}>{row.name ?? t('common:deletedUser')}</span>
          {row.email && <span className={styles.muted}>{row.email}</span>}
        </span>
      ),
    },
    {
      key: 'plan',
      header: t('usage.columns.plan'),
      render: (row) => (row.role === 'admin' ? t('usage.admin') : [t(`enums:planKey.${row.plan}`), row.interval && t(`usage.interval.${row.interval}`)].filter(Boolean).join(' · ')),
    },
    { key: 'today', header: t('usage.columns.today'), render: (row) => (row.today ? t('usage.today', { used: format.number(row.today.used), limit: format.number(row.today.limit) }) : '—') },
    { key: 'calls', header: t('usage.columns.calls'), render: (row) => format.number(row.calls) },
    { key: 'cost', header: t('usage.columns.cost'), render: (row) => (row.unpriced && row.cost === 0 ? <span className={styles.muted}>{t('usage.noPrice')}</span> : usd(row.cost)) },
  ]

  return (
    <>
      <PageTitle eyebrow={t('page.eyebrow')} title={t('page.title')} description={t('usage.description')} />
      <AiMatchingTabs value="usage" />

      <div className={styles.toolbar}>
        <SelectField
          variant="filter"
          aria-label={t('usage.month')}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          options={months.map((value) => ({ value, label: format.date(`${value}-01`, { month: 'long', year: 'numeric' }) }))}
          data-usage-month
        />
        <p className={styles.estimate}>{t('usage.estimate')}</p>
      </div>

      {isError && <p className={styles.estimate}>{t('page.loadError')}</p>}
      {isLoading && <UsageSkeleton />}
      {data && (
        <div className={isFetching ? styles.busy : undefined}>
          <div className={styles.providers}>
            <ProviderCard provider="openai" data={data.providers.openai} billingUrl={data.billingUrl} />
            <ProviderCard provider="places" data={data.providers.places} billingUrl={data.placesBillingUrl} />
          </div>

          <section className={styles.section} aria-labelledby="usage-breakdown">
            <SectionTitle id="usage-breakdown" title={t('usage.breakdown.title')} description={t('usage.breakdown.description')} />
            {data.breakdown.length ? (
              <DataTable columns={breakdownColumns} rows={data.breakdown} getRowKey={(row) => `${row.provider}|${row.model}|${row.kind}`} caption={t('usage.breakdown.title')} />
            ) : (
              <Panel padding={20}>
                <p className={styles.muted}>{t('usage.empty')}</p>
              </Panel>
            )}
          </section>

          <section className={styles.section} aria-labelledby="usage-users">
            <SectionTitle id="usage-users" title={t('usage.users.title')} description={t('usage.users.description')} />
            {data.topUsers.length ? (
              <DataTable columns={userColumns} rows={data.topUsers} getRowKey={(row) => row.id} getRowProps={(row) => ({ 'data-usage-user': row.id })} caption={t('usage.users.title')} />
            ) : (
              <Panel padding={20}>
                <p className={styles.muted}>{t('usage.empty')}</p>
              </Panel>
            )}
          </section>

          <section className={styles.section} aria-labelledby="usage-settings">
            <SectionTitle id="usage-settings" title={t('usage.settings.title')} description={t('usage.settings.description')} />
            {/* Re-made per month: another month lists other models to price. */}
            <UsageSettings key={month} data={data} readOnly={!can(me, 'ai.manage')} />
          </section>
        </div>
      )}
    </>
  )
}
