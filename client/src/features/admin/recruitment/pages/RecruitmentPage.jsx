import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, Bookmark, CalendarCheck, CalendarClock, Clock, FileText, Layers, MessageSquare } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import { can } from '@/app/permissions.js'
import CountryFilter from '@/features/admin/overview/components/CountryFilter.jsx'
import { useGetRecruitmentQuery } from '@/features/admin/overview/api.js'
import { usePreferences } from '@/lib/preferences.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { cx } from '@/utils/cx.js'
import CandidateMovement from '../components/CandidateMovement.jsx'
import FunnelChart from '../components/FunnelChart.jsx'
import OversightSidebar from '../components/OversightSidebar.jsx'
import PipelineStages, { StagesSkeleton } from '../components/PipelineStages.jsx'
import styles from './RecruitmentPage.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)
/* The funnel's six stage ellipses (width, height in px), narrowing like the loaded chart. */
const FUNNEL_SKELETON = [
  [150, 250],
  [160, 205],
  [120, 170],
  [95, 140],
  [75, 115],
  [60, 64],
]

/**
 * Read-only recruiter activity (M-178 … M-180, OD5, P10-Q13). "Data view" (/admin/recruitment) shows the current stage
 * counts, "Funnel view" (/admin/recruitment/funnel) the ever-reached counts; picking a category in either filters the
 * candidate movement table. Everything follows the country filter (M-138).
 */
export default function RecruitmentPage() {
  const { t } = useTranslation('adminRecruitment')
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const { params, setFilter } = useUrlFilters()
  const country = params.get('country') ?? ''
  const { data, isLoading, isFetching, currentData } = useGetRecruitmentQuery(country ? { country } : {}, { refetchOnMountOrArgChange: true })
  // A new country: the numbers on screen are the previous one's until the new ones arrive.
  const busy = isFetching && !currentData && !isLoading
  const dim = (className) => cx(className, busy && styles.busy)
  const view = pathname.endsWith('/funnel') ? 'funnel' : 'data'
  const [stage, setStage] = useState(null)
  const toggleStage = (next) => setStage((current) => (current === next ? null : next))
  const views = [
    { id: 'data', label: t('views.data'), icon: FileText, iconSize: 13 },
    { id: 'funnel', label: t('views.funnel'), icon: Layers, iconSize: 13 },
  ]

  return (
    <>
      <PageTitle
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <div className={styles.actions}>
            <CountryFilter value={country} onChange={(value) => setFilter('country', value)} />
            {can(me, 'audit.view') && (
              <Button as={Link} to={admin('audit-logs')} variant="outline" leftIcon={<Icon as={Clock} size={13} />}>
                {t('auditLog')}
              </Button>
            )}
          </div>
        }
      />
      <div className={dim(styles.stats)} aria-busy={busy || undefined}>
        <StatCard label={t('stats.publishedRoles')} value={data?.stats.publishedRoles ?? 0} caption={t('stats.allTime')} icon={BriefcaseBusiness} loading={isLoading} />
        <StatCard label={t('stats.applications')} value={data?.stats.applications ?? 0} caption={t('stats.applicationsCaption')} icon={FileText} loading={isLoading} />
        <StatCard label={t('stats.shortlisted')} value={data?.stats.shortlisted ?? 0} caption={t('stats.allTime')} icon={Bookmark} loading={isLoading} />
        <StatCard label={t('stats.reviewedOutreach')} value={data?.stats.reviewedOutreach ?? 0} caption={t('stats.allTime')} icon={MessageSquare} loading={isLoading} />
        {/* P11d-Q24: counts only; admins never see interview notes or documents. */}
        <StatCard label={t('stats.interviewsScheduled')} value={data?.stats.interviewsScheduled ?? 0} caption={t('stats.allTime')} icon={CalendarClock} loading={isLoading} />
        <StatCard label={t('stats.interviewsCompleted')} value={data?.stats.interviewsCompleted ?? 0} caption={t('stats.allTime')} icon={CalendarCheck} loading={isLoading} />
      </div>
      <section className={styles.pipeline} aria-labelledby="hiring-pipeline">
        <SectionTitle id="hiring-pipeline" title={t('pipeline.title')} description={t(view === 'funnel' ? 'pipeline.funnelText' : 'pipeline.dataText')}>
          <ViewToggle
            label={t('views.label')}
            items={views}
            value={view}
            onChange={(next) => navigate(`${admin(next === 'funnel' ? 'recruitment/funnel' : 'recruitment')}${search}`)}
          />
        </SectionTitle>
        <div className={dim(styles.pipelineBody)} aria-busy={busy || undefined}>
          {isLoading &&
            (view === 'funnel' ? (
              <SkeletonRegion className={styles.funnelSkeleton}>
                <h3 className={styles.funnelTitle}>{t('funnel.title')}</h3>
                <div className={styles.funnelStages}>
                  {FUNNEL_SKELETON.map(([width, height]) => (
                    <div key={height} className={styles.funnelStage}>
                      <span className={styles.funnelShape}>
                        <Skeleton shape="block" width={width} height={height} className={styles.funnelEllipse} />
                      </span>
                      <Skeleton width={56} />
                      <Skeleton width={14} height={12} />
                    </div>
                  ))}
                </div>
              </SkeletonRegion>
            ) : (
              <StagesSkeleton />
            ))}
          {data &&
            (view === 'funnel' ? (
              <FunnelChart funnel={data.funnel} selectedStage={stage} onSelectStage={toggleStage} />
            ) : (
              <PipelineStages stages={data.stages} selectedStage={stage} onSelectStage={toggleStage} />
            ))}
        </div>
      </section>
      <div className={dim(styles.layout)} aria-busy={busy || undefined}>
        <CandidateMovement rows={data?.movement ?? []} stage={stage} onClearStage={() => setStage(null)} loading={isLoading} />
        <OversightSidebar roles={data?.roles ?? []} coverage={data?.coverage ?? []} loading={isLoading} />
      </div>
    </>
  )
}
