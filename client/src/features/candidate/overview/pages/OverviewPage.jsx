import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Eye, Search, ShieldCheck, SlidersHorizontal, Sun } from 'lucide-react'
import { useGetMeQuery } from '@/app/api.js'
import { Button, Icon, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import aiNavGlyph from '@/assets/icons/ai-nav.svg'
import { useFormat } from '@/lib/preferences.js'
import { useGetCandidateOverviewQuery, useGetRecommendedJobsQuery, useGetSavedJobsQuery, useSaveToggle, useSearchJobsQuery } from '@/features/candidate/jobs/api.js'
import JobCard, { JobCardSkeleton } from '@/features/candidate/jobs/components/JobCard.jsx'
import { useCounters } from '@/app/counters.js'
import ApplicationActivityCard from '../components/ApplicationActivityCard.jsx'
import InsightCard from '../components/InsightCard.jsx'
import ProfileStrengthCard from '../components/ProfileStrengthCard.jsx'
import VerificationCard from '../components/VerificationCard.jsx'
import styles from './OverviewPage.module.css'

const TABS = ['for-you', 'recent', 'saved']
const SHOWN = 3
const EMPTY_ICONS = { 'for-you': Search, recent: Search, saved: Bookmark }

const partOfDay = (hour) => (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening')

/** Profile views over the last 30 days against the 30 before (M-184), as "↑ 12%"; nothing when there is no base. */
function viewsDelta(views, format) {
  if (!views?.previous30) return undefined
  const change = (views.last30 - views.previous30) / views.previous30
  return `${change >= 0 ? '↑' : '↓'} ${format.number(Math.abs(change), { style: 'percent', maximumFractionDigits: 0 })}`
}

/**
 * Candidate Overview: KPIs (Recommended jobs by score for Plus, else U8; saved jobs and profile views from the server),
 * active applications from the counters (M-094), the For you / Recently added / Saved lists and the profile rail with
 * the AI insights teaser for Plus.
 */
export default function OverviewPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const [tab, setTab] = useState('for-you')
  const [now] = useState(() => new Date())
  const { data: me } = useGetMeQuery()
  const { data: overview, isLoading: overviewLoading } = useGetCandidateOverviewQuery()
  const { data: recommended, isLoading: recommendedLoading } = useGetRecommendedJobsQuery(undefined, { skip: tab !== 'for-you' })
  const { data: recent, isLoading: recentLoading } = useSearchJobsQuery({ sort: 'newest' }, { skip: tab !== 'recent' })
  const { data: saved, isLoading: savedLoading } = useGetSavedJobsQuery(undefined, { skip: tab !== 'saved' })
  const toggleSave = useSaveToggle()
  const counters = useCounters()
  const lists = { 'for-you': recommended, recent, saved }
  const jobs = lists[tab]?.items.slice(0, SHOWN)
  const jobsLoading = { 'for-you': recommendedLoading, recent: recentLoading, saved: savedLoading }[tab]
  const firstName = me?.fullName.split(/\s+/)[0] ?? ''

  return (
    <div>
      <div className={styles.dateRow}>
        <p className={styles.date}>
          {format.date(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <section className={styles.hero}>
        <div>
          <p className={styles.greeting}>
            {t(`findJobs:overview.${partOfDay(now.getHours())}`, { name: firstName })} <Icon as={Sun} size={13} />
          </p>
          <h1 className={styles.title}>
            {t('findJobs:overview.title')}
            <br />
            <span className={styles.titleMuted}>{t('findJobs:overview.titleMuted')}</span>
          </h1>
          <p className={styles.lead}>{t('findJobs:overview.lead')}</p>
        </div>
        <Button as={Link} to="/candidate/jobs" leftIcon={<Icon as={Search} size={14} />} rightIcon={<Icon as={ArrowUpRight} size={13} />}>
          {t('findJobs:overview.explore')}
        </Button>
      </section>

      <div className={styles.stats}>
        <Link to="/candidate/jobs" className={styles.statLink} data-stat="recommended">
          <StatCard
            label={t('findJobs:overview.stats.recommended')}
            value={overview?.recommended.count ?? 0}
            delta={overview?.recommended.newThisWeek ? t('findJobs:overview.stats.recommendedDelta', { count: overview.recommended.newThisWeek }) : undefined}
            caption={t(overview?.recommended.byScore ? 'findJobs:overview.stats.recommendedCaptionScore' : 'findJobs:overview.stats.recommendedCaption')}
            iconSrc={aiNavGlyph}
            loading={overviewLoading}
          />
        </Link>
        <Link to="/candidate/applications" className={styles.statLink}>
          <StatCard label={t('findJobs:overview.stats.applications')} value={counters?.activeApplications ?? 0} caption={t('findJobs:overview.stats.applicationsCaption')} icon={BriefcaseBusiness} loading={!counters} />
        </Link>
        <Link to="/candidate/jobs" className={styles.statLink} data-stat="saved">
          <StatCard label={t('findJobs:overview.stats.saved')} value={overview?.savedJobs ?? 0} caption={t('findJobs:overview.stats.savedCaption')} icon={Bookmark} loading={overviewLoading} />
        </Link>
        <Link to="/candidate/profile" className={styles.statLink} data-stat="views">
          <StatCard
            label={t('findJobs:overview.stats.views')}
            value={overview?.profileViews.last30 ?? 0}
            delta={viewsDelta(overview?.profileViews, format)}
            caption={t('findJobs:overview.stats.viewsCaption')}
            icon={Eye}
            loading={overviewLoading}
          />
        </Link>
      </div>

      <div className={styles.columns}>
        <section className={styles.main}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>{t('findJobs:overview.opportunities')}</h2>
              <p className={styles.sectionText}>{t('findJobs:overview.opportunitiesText')}</p>
            </div>
            <Link to="/candidate/jobs" className={styles.viewAll}>
              {t('findJobs:overview.viewAll')}
              <Icon as={ArrowRight} size={12} />
            </Link>
          </div>

          <div className={styles.tabsRow}>
            <SegmentedTabs
              label={t('findJobs:overview.tabsLabel')}
              tabs={TABS.map((id) => ({ id, label: t(`findJobs:overview.tabs.${id}`), ...(id === 'for-you' && { iconSrc: aiGlyph }) }))}
              value={tab}
              onChange={setTab}
            />
            <Link to="/candidate/profile" className={styles.preferences}>
              <Icon as={SlidersHorizontal} size={12} />
              {t('findJobs:overview.preferences')}
            </Link>
          </div>

          <div className={styles.list} role="tabpanel">
            {jobsLoading ? (
              <SkeletonRegion className={styles.skeletonList}>
                {Array.from({ length: SHOWN }, (_, index) => (
                  <JobCardSkeleton key={index} />
                ))}
              </SkeletonRegion>
            ) : jobs?.length === 0 ? (
              <EmptyState
                icon={EMPTY_ICONS[tab]}
                title={t(`findJobs:overview.empty.${tab}`)}
                description={t(`findJobs:overview.empty.${tab}Text`)}
                action={
                  <Button as={Link} to="/candidate/jobs" variant="secondary">
                    {t('findJobs:overview.browse')}
                  </Button>
                }
              />
            ) : (
              jobs?.map((job) => <JobCard key={job.id} job={job} onToggleSave={toggleSave} />)
            )}
          </div>
          <p className={styles.caption}>
            <Icon as={ShieldCheck} size={13} />
            {t('findJobs:overview.caption')}
          </p>
        </section>

        <aside className={styles.rail} aria-label={t('findJobs:overview.rail')}>
          <InsightCard />
          <ProfileStrengthCard />
          <VerificationCard />
          <ApplicationActivityCard />
        </aside>
      </div>
    </div>
  )
}
