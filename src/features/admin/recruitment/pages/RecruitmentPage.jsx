import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, Bookmark, Clock, FileText, Layers, MessageSquare } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { Button, Icon } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import CandidateMovement from '../components/CandidateMovement.jsx'
import FunnelChart from '../components/FunnelChart.jsx'
import OversightSidebar from '../components/OversightSidebar.jsx'
import PipelineStages from '../components/PipelineStages.jsx'
import { APPLICATION_COVERAGE, CANDIDATES, PUBLISHED_ROLES } from '../data/recruitment.js'
import styles from './RecruitmentPage.module.css'

const VIEWS = [
  { id: 'data', label: 'Data view', icon: FileText, iconSize: 13 },
  { id: 'funnel', label: 'Funnel view', icon: Layers, iconSize: 13 },
]

const admin = (to) => workspacePath(WORKSPACES.admin, to)

/**
 * Read-only recruiter activity overview. "Data view" (/admin/recruitment) and "Funnel view"
 * (/admin/recruitment/funnel) are two views of this page; picking a pipeline stage in either one
 * filters the candidate movement table.
 */
export default function RecruitmentPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const view = pathname.endsWith('/funnel') ? 'funnel' : 'data'
  const [stage, setStage] = useState(null)

  const shortlistedCount = CANDIDATES.filter((candidate) => candidate.shortlisted).length
  const toggleStage = (next) => setStage((current) => (current === next ? null : next))

  return (
    <>
      <PageTitle
        eyebrow="Recruitment oversight"
        title="See the journey. Protect the decision."
        description="A read-only view of recruiter activity across roles, applications, shortlists, pipeline stages, and reviewed outreach."
        actions={
          <Button as={Link} to={admin('audit-logs')} variant="outline" leftIcon={<Icon as={Clock} size={13} />}>
            View audit log
          </Button>
        }
      />

      <div className={styles.stats}>
        <StatCard label="Published roles" value={PUBLISHED_ROLES.length} caption="Open recruiter opportunities" icon={BriefcaseBusiness} />
        <StatCard label="Applications" value={APPLICATION_COVERAGE.length} caption="Candidate submissions recorded" icon={FileText} />
        <StatCard label="Shortlisted" value={shortlistedCount} caption="Recruiter-selected candidates" icon={Bookmark} />
        <StatCard label="Reviewed outreach" value={0} caption="Drafts saved after human review" icon={MessageSquare} />
      </div>

      <section className={styles.pipeline} aria-labelledby="hiring-pipeline">
        <SectionTitle
          id="hiring-pipeline"
          title="Hiring pipeline"
          description="Recruiters own hiring decisions. Admins can inspect activity and use moderation or audit tools when needed."
        >
          <ViewToggle
            variant="primary"
            label="Recruitment view"
            items={VIEWS}
            value={view}
            onChange={(next) => navigate(admin(next === 'funnel' ? 'recruitment/funnel' : 'recruitment'))}
          />
        </SectionTitle>
        <div className={styles.pipelineBody}>
          {view === 'funnel' ? (
            <FunnelChart selectedStage={stage} onSelectStage={toggleStage} />
          ) : (
            <PipelineStages candidates={CANDIDATES} selectedStage={stage} onSelectStage={toggleStage} />
          )}
        </div>
      </section>

      <div className={styles.layout}>
        <CandidateMovement candidates={CANDIDATES} stage={stage} onClearStage={() => setStage(null)} />
        <OversightSidebar roles={PUBLISHED_ROLES} coverage={APPLICATION_COVERAGE} />
      </div>
    </>
  )
}
