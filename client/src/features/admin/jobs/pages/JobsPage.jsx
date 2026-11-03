import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BriefcaseBusiness, RotateCcw } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon, TextField } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import JobSummaryDialog from '@/features/ai/components/JobSummaryDialog.jsx'
import JobStatusBadge from '@/features/recruiter/jobs/components/JobStatusBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetAdminJobSummaryQuery, useGetAdminJobsQuery, useRegenerateAdminJobSummaryMutation } from '../api.js'
import styles from './JobsPage.module.css'

/** The AI summary of one job for the admin (M-058), with Regenerate, which replaces the cached text. */
function AdminJobSummary({ job, onClose }) {
  const { t } = useTranslation('ai')
  const summary = useGetAdminJobSummaryQuery(job.id)
  const [regenerate, regenerating] = useRegenerateAdminJobSummaryMutation()
  const state = { isLoading: summary.isFetching || regenerating.isLoading, error: regenerating.error ?? summary.error, data: summary.data }
  return (
    <JobSummaryDialog
      open
      job={job}
      state={state}
      onRetry={() => (regenerating.error ? regenerate(job.id) : summary.refetch())}
      onClose={onClose}
      actions={
        <Button variant="outline" leftIcon={<Icon as={RotateCcw} size={14} />} loading={regenerating.isLoading} onClick={() => regenerate(job.id)} data-regenerate>
          {t('jobSummary.regenerate')}
        </Button>
      }
    />
  )
}

/**
 * Admin > Jobs (P9-Q5): published jobs from the server with each one's AI summary. Phase 10 extends this list with every
 * status and its filter, pagination and "Open case" (M-046).
 */
export default function JobsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const format = useFormat()
  const { data } = useGetAdminJobsQuery()
  const [query, setQuery] = useState('')
  const jobs = data?.items ?? []

  const published = jobs.filter((job) => job.status === 'published')
  const needle = query.trim().toLowerCase()
  const rows = published.filter((job) => !needle || job.title.toLowerCase().includes(needle) || job.company.displayName.toLowerCase().includes(needle))
  const summaryJob = jobId ? jobs.find((job) => job.id === jobId) : undefined

  const columns = [
    { key: 'title', header: 'Role', width: 263, render: (job) => <span className={styles.title}>{job.title}</span> },
    { key: 'company', header: 'Company', width: 161, render: (job) => <span className={styles.muted}>{job.company.displayName}</span> },
    { key: 'salary', header: 'Salary', width: 173, render: (job) => <span className={styles.muted}>{job.salary ? format.salary(job.salary) : '—'}</span> },
    { key: 'status', header: 'Status', width: 162, render: (job) => <JobStatusBadge status={job.status} restricted={Boolean(job.restricted)} /> },
    {
      key: 'actions',
      width: 367,
      header: <span className="sr-only">Actions</span>,
      render: (job) => (
        <div className={styles.actions} data-admin-job={job.id}>
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
          <DataTable className={styles.table} caption="Published jobs" columns={columns} rows={rows} getRowKey={(job) => job.id} />
        ) : (
          data && (
            <EmptyState
              icon={BriefcaseBusiness}
              title={published.length === 0 ? 'No published roles' : 'No roles match your search'}
              description={published.length === 0 ? 'Roles published by recruiters appear here for review.' : 'Try a different job title or company.'}
              action={
                published.length > 0 && (
                  <Button variant="outline" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                )
              }
            />
          )
        )}
      </div>

      {summaryJob && <AdminJobSummary key={summaryJob.id} job={summaryJob} onClose={() => navigate('/admin/jobs')} />}
    </>
  )
}
