import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, Search } from 'lucide-react'
import { Avatar, Icon, SelectField, TextField } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import StageSelect from '@/features/recruiter/hiring-pipeline/components/StageSelect.jsx'
import { REJECTED } from '@/features/recruiter/hiring-pipeline/data/pipeline.js'
import { usePipeline } from '@/features/recruiter/hiring-pipeline/hooks/usePipeline.js'
import styles from './ApplicationsPage.module.css'

const profilePath = (applicantId) => `/recruiter/find-candidates/${applicantId}`

/** Applications: search and stage filter over the applicants, with a stage menu per row and a confirmed reject. */
export default function ApplicationsPage() {
  const { stages, applicants, moveTo } = usePipeline()
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [rejecting, setRejecting] = useState(null)

  const stageOptions = useMemo(() => [...stages, { id: REJECTED, name: 'Rejected' }], [stages])
  const filterOptions = useMemo(() => [{ value: 'all', label: 'All stages' }, ...stageOptions.map((stage) => ({ value: stage.id, label: stage.name }))], [stageOptions])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return applicants.filter(
      (applicant) =>
        (stageFilter === 'all' || applicant.stageId === stageFilter) &&
        (!needle || `${applicant.name} ${applicant.title}`.toLowerCase().includes(needle)),
    )
  }, [applicants, query, stageFilter])

  function changeStage(applicant, stageId) {
    if (stageId === REJECTED) setRejecting(applicant)
    else moveTo(applicant.id, stageId)
  }

  const columns = [
    {
      key: 'candidate',
      header: 'Candidate',
      width: '26.7%',
      render: (applicant) => (
        <Link to={profilePath(applicant.id)} className={styles.candidate}>
          <Avatar name={applicant.name} size={36} colors={applicant.avatar} className={styles.avatar} />
          <span className={styles.name}>{applicant.name}</span>
        </Link>
      ),
    },
    { key: 'role', header: 'Role', width: '27.6%', render: (applicant) => <span className={styles.cell}>{applicant.title}</span> },
    { key: 'experience', header: 'Experience', width: '15%', render: (applicant) => <span className={styles.cell}>{applicant.experienceYears} years</span> },
    {
      key: 'stage',
      header: 'Stage',
      width: '21.3%',
      render: (applicant) => (
        <StageSelect
          options={stageOptions}
          value={applicant.stageId}
          label={`Update stage for ${applicant.name}`}
          onChange={(stageId) => changeStage(applicant, stageId)}
        />
      ),
    },
    {
      key: 'profile',
      header: <span className="sr-only">Profile</span>,
      render: (applicant) => (
        <Link to={profilePath(applicant.id)} className={styles.profileLink} aria-label={`View ${applicant.name}’s profile`}>
          <Icon as={ArrowUpRight} size={15} />
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageTitle
        title="Every application deserves a fair look."
        description="Review evidence, move people forward, and keep your process clear."
      />

      <div className={styles.filters}>
        <TextField
          className={styles.search}
          type="search"
          aria-label="Search applicants"
          placeholder="Search applicants"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField
          className={styles.stageFilter}
          aria-label="Filter applicant stage"
          options={filterOptions}
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
        />
      </div>

      <div className={styles.table}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No applicants match"
            description="Try a different name or role, or choose another stage."
          />
        ) : (
          <DataTable caption="Applicants" columns={columns} rows={rows} getRowKey={(applicant) => applicant.id} />
        )}
      </div>

      <section className={styles.activity} aria-labelledby="portal-activity">
        <SectionHeading id="portal-activity" title="Candidate portal activity" description="Local applications created in this prototype" />
        <div className={styles.activityBody}>
          <EmptyState
            size="lg"
            icon={FileText}
            iconSize={24}
            title="Room for your next great application"
            description="Applications to roles you publish appear here. Only applications shared with your company are visible in this workspace."
          />
        </div>
      </section>

      <ConfirmDialog
        open={rejecting !== null}
        title="Reject this application?"
        description={rejecting ? `${rejecting.name} will be moved out of your pipeline. You can move them back to a stage from this page at any time.` : undefined}
        confirmLabel="Reject application"
        tone="danger"
        onClose={() => setRejecting(null)}
        onConfirm={() => {
          moveTo(rejecting.id, REJECTED)
          setRejecting(null)
        }}
      />
    </div>
  )
}
