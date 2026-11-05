import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Award, BookOpen, BriefcaseBusiness, Download, FileText, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { adminNavItemFor, can } from '@/app/permissions.js'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon } from '@/components/ui'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { cx } from '@/utils/cx.js'
import { useGetOverviewQuery } from '../api.js'
import CountryFilter from '../components/CountryFilter.jsx'
import DemandedSkillsCard from '../components/DemandedSkillsCard.jsx'
import MarketplaceHealthCard from '../components/MarketplaceHealthCard.jsx'
import PlatformActivityCard from '../components/PlatformActivityCard.jsx'
import RecentActivityCard from '../components/RecentActivityCard.jsx'
import styles from './OverviewPage.module.css'

/**
 * Admin › Overview (§3.15, OQ-5, M-172 … M-177): every number from the server, all-time, following the country filter
 * (M-138); the chart takes a period. A card links to the page that lists what it counts, when the admin may open it.
 */
export default function OverviewPage() {
  const { t } = useTranslation('adminOverview')
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { params, setFilter } = useUrlFilters()
  const country = params.get('country') ?? ''
  const { data, isLoading, isFetching, currentData } = useGetOverviewQuery(country ? { country } : {}, { refetchOnMountOrArgChange: true })
  // A new country: the numbers on screen are the previous one's until the new ones arrive.
  const busy = isFetching && !currentData && !isLoading
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const kpis = data?.kpis
  const roleMatch = kpis?.averageRoleMatch

  const stats = [
    { key: 'candidateRegistrations', icon: Users, to: '/admin/candidates' },
    { key: 'activeUsers', icon: TrendingUp, to: '/admin/candidates?status=active' },
    { key: 'publishedJobs', icon: BriefcaseBusiness, to: '/admin/jobs?status=published' },
    { key: 'applications', icon: FileText, to: '/admin/applications' },
    { key: 'verifiedProfiles', icon: ShieldCheck, to: '/admin/candidates?verification=verified' },
    { key: 'courseEnrollments', icon: BookOpen, to: '/admin/courses' },
    { key: 'courseBadges', icon: Award, to: '/admin/courses' },
    { key: 'averageRoleMatch', iconSrc: aiNavIcon, to: '/admin/ai-matching' },
  ]
  // The country travels with the links into the pages that filter by it.
  const withCountry = (to) => (country && !to.startsWith('/admin/courses') && !to.startsWith('/admin/ai-matching') ? `${to}${to.includes('?') ? '&' : '?'}country=${country}` : to)

  async function exportReport() {
    setExporting(true)
    setExportError('')
    try {
      await downloadFromApi('/admin/overview/export', { country })
    } catch (error) {
      setExportError(errorText.code(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageTitle
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <div className={styles.actions}>
            <CountryFilter value={country} onChange={(value) => setFilter('country', value)} />
            {can(me, 'reports.export') && (
              <Button variant="outline" leftIcon={<Icon as={Download} size={14} />} onClick={exportReport} loading={exporting}>
                {t('export')}
              </Button>
            )}
          </div>
        }
      />
      {exportError && (
        <p className={styles.error} role="alert">
          {exportError}
        </p>
      )}
      <div className={cx(styles.stats, busy && styles.busy)} aria-busy={busy || undefined}>
        {stats.map(({ key, to, ...stat }) => {
          const value = key === 'averageRoleMatch' ? (roleMatch?.value == null ? '—' : `${roleMatch.value}%`) : (kpis?.[key] ?? 0)
          const caption = key === 'averageRoleMatch' ? t('kpis.acrossRoles', { count: roleMatch?.roles ?? 0 }) : t('kpis.allTime')
          const card = <StatCard {...stat} label={t(`kpis.${key}`)} value={value} caption={caption} loading={isLoading} />
          return can(me, adminNavItemFor(to.split('?')[0])?.permission) ? (
            <Link key={key} to={withCountry(to)} className={styles.statLink} data-kpi={key}>
              {card}
            </Link>
          ) : (
            <div key={key} data-kpi={key}>
              {card}
            </div>
          )
        })}
      </div>
      <div className={styles.activity}>
        <PlatformActivityCard country={country} />
        <MarketplaceHealthCard health={data?.health} loading={isLoading} />
      </div>
      <div className={cx(styles.insights, busy && styles.busy)} aria-busy={busy || undefined}>
        <DemandedSkillsCard skills={data?.skills ?? []} loading={isLoading} />
        <RecentActivityCard events={data?.recent ?? []} showLink={can(me, 'audit.view')} loading={isLoading} />
      </div>
    </>
  )
}
