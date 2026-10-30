import { Link } from 'react-router-dom'
import { UserX } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Button } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import styles from './CandidateMovement.module.css'

const COLUMNS = [
  {
    key: 'candidate',
    header: 'Candidate',
    width: 278,
    render: (candidate) => (
      <div className={styles.person}>
        <span className={styles.avatar} style={{ background: candidate.tone[0], color: candidate.tone[1] }} aria-hidden="true">
          {candidate.name
            .split(' ')
            .map((part) => part[0])
            .join('')}
        </span>
        <div>
          <p className={styles.name}>{candidate.name}</p>
          <p className={styles.title}>{candidate.title}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'stage',
    header: 'Current stage',
    width: 152,
    render: ({ stage }) => <PillBadge tone={stage === 'Interview' ? 'accent' : 'neutral'}>{stage}</PillBadge>,
  },
  {
    key: 'shortlist',
    header: 'Shortlist',
    width: 177,
    render: ({ shortlisted }) => (
      <PillBadge tone={shortlisted ? 'info' : 'neutral'}>{shortlisted ? 'Shortlisted' : 'Not shortlisted'}</PillBadge>
    ),
  },
  { key: 'outreach', header: 'Outreach', render: () => <span className={styles.outreach}>No outreach</span> },
]

/** Current pipeline state per candidate, optionally narrowed to one stage (set from the stage cards / funnel). */
export default function CandidateMovement({ candidates, stage, onClearStage }) {
  const rows = stage ? candidates.filter((candidate) => candidate.stage === stage) : candidates

  return (
    <section aria-labelledby="candidate-movement">
      <SectionTitle
        id="candidate-movement"
        title="Candidate movement"
        description="Current shortlist and pipeline state from the recruiter workspace."
      >
        <Link to={workspacePath(WORKSPACES.admin, 'applications')} className={styles.link}>
          View applications
        </Link>
      </SectionTitle>

      <div className={styles.body}>
        {stage && (
          <p className={styles.filter} role="status">
            Showing candidates at the <strong>{stage}</strong> stage
            <Button variant="ghost" size="sm" onClick={onClearStage}>
              Clear filter
            </Button>
          </p>
        )}
        {rows.length > 0 ? (
          <DataTable
            className={styles.table}
            columns={COLUMNS}
            rows={rows}
            getRowKey={(candidate) => candidate.id}
            caption="Candidate movement"
          />
        ) : (
          <EmptyState
            icon={UserX}
            title={`No candidates at the ${stage} stage`}
            description="Pick another stage or clear the filter to see everyone."
          />
        )}
      </div>
    </section>
  )
}
