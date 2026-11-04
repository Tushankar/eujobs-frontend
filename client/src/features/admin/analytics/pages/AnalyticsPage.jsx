import { useTranslation } from 'react-i18next'
import { Building2, MessageSquare, TrendingUp, Users } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useGetAnalyticsQuery } from '@/features/admin/overview/api.js'
import CountryFilter from '@/features/admin/overview/components/CountryFilter.jsx'
import { PERIODS } from '@/features/admin/overview/useActivity.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import ActivityCard from '../components/ActivityCard.jsx'
import { DemandedSkills, MatchingQuality } from '../components/InsightCards.jsx'
import styles from './AnalyticsPage.module.css'

/**
 * Analytics (§3.15, M-175 … M-180, U11, OQ-5): all-time cards from the server that follow the country filter, and the
 * activity chart for a period. The view, the period and the country live in the URL (?view=line&period=last_week).
 */
export default function AnalyticsPage() {
  const { t } = useTranslation('adminOverview')
  const { params, setFilter } = useUrlFilters()
  const view = params.get('view') === 'line' ? 'line' : 'bar'
  const period = PERIODS.includes(params.get('period')) ? params.get('period') : PERIODS[0]
  const country = params.get('country') ?? ''
  const { data } = useGetAnalyticsQuery(country ? { country } : {}, { refetchOnMountOrArgChange: true })
  const conversion = data?.shortlistConversion
  const stats = [
    {
      key: 'shortlistConversion',
      value: conversion?.percent == null ? '—' : `${conversion.percent}%`,
      caption: t('analytics.conversionCaption', { shortlisted: conversion?.shortlisted ?? 0, count: conversion?.applications ?? 0 }),
      icon: TrendingUp,
    },
    { key: 'recruiterAccounts', value: data?.recruiterAccounts ?? 0, caption: t('kpis.allTime'), icon: Users },
    { key: 'companyRegistrations', value: data?.companyRegistrations ?? 0, caption: t('kpis.allTime'), icon: Building2 },
    { key: 'reviewedOutreach', value: data?.reviewedOutreach ?? 0, caption: t('kpis.allTime'), icon: MessageSquare },
  ]
  return (
    <>
      <PageTitle title={t('analytics.title')} description={t('analytics.description')} actions={<CountryFilter value={country} onChange={(value) => setFilter('country', value)} />} />
      <div className={styles.stats}>
        {stats.map(({ key, ...stat }) => (
          <div key={key} data-kpi={key}>
            <StatCard label={t(`analytics.${key}`)} {...stat} />
          </div>
        ))}
      </div>
      <div className={styles.split}>
        <ActivityCard view={view} period={period} country={country} onViewChange={(next) => setFilter('view', next)} onPeriodChange={(next) => setFilter('period', next)} />
        <DemandedSkills skills={data?.skills ?? []} />
      </div>
      <div className={styles.quality}>
        <MatchingQuality />
      </div>
    </>
  )
}
