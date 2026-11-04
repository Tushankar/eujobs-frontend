import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, Bookmark, Clock, FileText, Layers, MessageSquare } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { Button, Icon } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import { can } from '@/app/permissions.js'
import CountryFilter from '@/features/admin/overview/components/CountryFilter.jsx'
import { useGetRecruitmentQuery } from '@/features/admin/overview/api.js'
import { usePreferences } from '@/lib/preferences.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import CandidateMovement from '../components/CandidateMovement.jsx'
import FunnelChart from '../components/FunnelChart.jsx'
import OversightSidebar from '../components/OversightSidebar.jsx'
import PipelineStages from '../components/PipelineStages.jsx'
import styles from './RecruitmentPage.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)

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
  const { data } = useGetRecruitmentQuery(country ? { country } : {}, { refetchOnMountOrArgChange: true })
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
      <div className={styles.stats}>
        <StatCard label={t('stats.publishedRoles')} value={data?.stats.publishedRoles ?? 0} caption={t('stats.allTime')} icon={BriefcaseBusiness} />
        <StatCard label={t('stats.applications')} value={data?.stats.applications ?? 0} caption={t('stats.applicationsCaption')} icon={FileText} />
        <StatCard label={t('stats.shortlisted')} value={data?.stats.shortlisted ?? 0} caption={t('stats.allTime')} icon={Bookmark} />
        <StatCard label={t('stats.reviewedOutreach')} value={data?.stats.reviewedOutreach ?? 0} caption={t('stats.allTime')} icon={MessageSquare} />
      </div>
      <section className={styles.pipeline} aria-labelledby="hiring-pipeline">
        <SectionTitle id="hiring-pipeline" title={t('pipeline.title')} description={t(view === 'funnel' ? 'pipeline.funnelText' : 'pipeline.dataText')}>
          <ViewToggle
            variant="primary"
            label={t('views.label')}
            items={views}
            value={view}
            onChange={(next) => navigate(`${admin(next === 'funnel' ? 'recruitment/funnel' : 'recruitment')}${search}`)}
          />
        </SectionTitle>
        <div className={styles.pipelineBody}>
          {data &&
            (view === 'funnel' ? (
              <FunnelChart funnel={data.funnel} selectedStage={stage} onSelectStage={toggleStage} />
            ) : (
              <PipelineStages stages={data.stages} selectedStage={stage} onSelectStage={toggleStage} />
            ))}
        </div>
      </section>
      <div className={styles.layout}>
        <CandidateMovement rows={data?.movement ?? []} stage={stage} onClearStage={() => setStage(null)} />
        <OversightSidebar roles={data?.roles ?? []} coverage={data?.coverage ?? []} />
      </div>
    </>
  )
}
