import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BriefcaseBusiness } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, TextField } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import JobStatusBadge from '@/features/recruiter/jobs/components/JobStatusBadge.jsx'
import { formatSalary } from '@/features/recruiter/jobs/data/jobFields.js'
import { useJobs } from '@/features/recruiter/jobs/hooks/useJobs.js'
import JobSummaryModal from '../components/JobSummaryModal.jsx'
import styles from './JobsPage.module.css'

const COLUMNS = [
  { key: 'title', header: 'Role', render: (job) => <span className={styles.title}>{job.title}</span> },
  { key: 'company', header: 'Company', render: (job) => <span className={styles.muted}>{job.company}</span> },
  { key: 'salary', header: 'Salary', render: (job) => <span className={styles.muted}>{formatSalary(job) || '—'}</span> },
  { key: 'status', header: 'Status', render: (job) => <JobStatusBadge status={job.status} /> },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    render: (job) => (
      <div className={styles.actions}>
        <Button
          as={Link}
          to={`/admin/jobs/${job.id}/ai-summary`}
          variant="ghost"
          className={styles.summaryLink}
          leftIcon={<img src={aiSparkle} alt="" width={16} height={16} />}
          aria-label={`Ai Summary for ${job.title}`}
        >
          Ai Summary
        </Button>
        <RowActionLink to={`/admin/moderation/content/${job.id}`} aria-label={`Review ${job.title}`}>
          Review
        </RowActionLink>
      </div>
    ),
  },
]

export default function JobsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { jobs } = useJobs()
  const [query, setQuery] = useState('')

  const published = jobs.filter((job) => job.status === 'published')
  const needle = query.trim().toLowerCase()
  const rows = published.filter(
    (job) => !needle || job.title.toLowerCase().includes(needle) || (job.company ?? '').toLowerCase().includes(needle),
  )

  const summaryJob = jobId ? jobs.find((job) => job.id === jobId) : undefined
  if (jobId && !summaryJob) return <Navigate to="/admin/jobs" replace />

  return (
    <>
      <PageTitle title="A marketplace of meaningful work." description="Review published roles and keep opportunity quality high." />

      <div className={styles.toolbar}>
        <TextField
          type="search"
          aria-label="Search job title or company"
          placeholder="Search job title or company"
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className={styles.results}>
        {rows.length > 0 ? (
          <DataTable className={styles.table} caption="Published jobs" columns={COLUMNS} rows={rows} getRowKey={(job) => job.id} />
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title={published.length === 0 ? 'No published roles' : 'No roles match your search'}
            description={
              published.length === 0
                ? 'Roles published by recruiters appear here for review.'
                : 'Try a different job title or company.'
            }
            action={
              published.length > 0 && (
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              )
            }
          />
        )}
      </div>

      <JobSummaryModal job={summaryJob} open={Boolean(summaryJob)} onClose={() => navigate('/admin/jobs')} />
    </>
  )
}
