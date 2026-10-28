import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import AiJobSummaryModal from '@/features/candidate/jobs/components/AiJobSummaryModal.jsx'
import AiSummaryButton from '@/features/candidate/jobs/components/AiSummaryButton.jsx'
import JobLogo from '@/features/candidate/jobs/components/JobLogo.jsx'
import { APPLICATION_STATUS, formatApplied } from '@/features/candidate/jobs/data/applications.js'
import { getJob } from '@/features/candidate/jobs/data/jobs.js'
import { jobPath } from '@/features/candidate/jobs/data/jobUtils.js'
import { useApplications } from '@/features/candidate/jobs/hooks/useApplications.js'
import ApplicationActivityModal from '../components/ApplicationActivityModal.jsx'
import styles from './ApplicationsPage.module.css'

const FILTERS = [
  { id: 'all', label: 'All applications' },
  { id: 'applied', label: 'Applied' },
  { id: 'under-review', label: 'Under review' },
  { id: 'interview', label: 'Interview' },
  { id: 'withdrawn', label: 'Withdrawn' },
]

/** Applications: status filters over the persisted applications, with an activity dialog and withdraw. */
export default function ApplicationsPage() {
  const { applications, hasApplied, applyTo, withdraw } = useApplications()
  const [filter, setFilter] = useState('all')
  const [activityId, setActivityId] = useState(null)
  const [withdrawing, setWithdrawing] = useState(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const rows = useMemo(
    () =>
      applications
        .map((application) => ({ ...application, job: getJob(application.jobId) }))
        .filter((row) => row.job && (filter === 'all' || row.status === filter)),
    [applications, filter],
  )
  const activity = rows.find((row) => row.id === activityId) ?? applications.find((item) => item.id === activityId)
  const latest = applications.find((item) => item.status !== 'withdrawn')
  const latestJob = latest ? getJob(latest.jobId) : undefined

  const columns = [
    {
      key: 'opportunity',
      header: 'Opportunity',
      width: '37.8%',
      render: (row) => (
        <Link to={jobPath(row.job.id)} className={styles.opportunity}>
          <JobLogo company={row.job.company} logo={row.job.logo} size={36} />
          <span>
            <span className={styles.title}>{row.job.title}</span>
            <span className={styles.sub}>
              {row.job.company} · {row.job.workMode}
            </span>
          </span>
        </Link>
      ),
    },
    { key: 'applied', header: 'Applied', width: '13.6%', render: (row) => <span className={styles.date}>{formatApplied(row.appliedAt)}</span> },
    {
      key: 'status',
      header: 'Status',
      width: '21.2%',
      render: (row) => <StatusBadge tone={APPLICATION_STATUS[row.status].tone}>{APPLICATION_STATUS[row.status].label}</StatusBadge>,
    },
    {
      key: 'next',
      header: 'Next step',
      render: (row) => (
        <Button variant="ghost" className={styles.activity} rightIcon={<Icon as={ArrowRight} size={12} />} onClick={() => setActivityId(row.id)}>
          View activity
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageTitle
        className={styles.pageTitle}
        title="Every step, in one place."
        description="Keep your next chapter moving. Track your applications without the guesswork."
        actions={<AiSummaryButton onClick={() => setSummaryOpen(true)} disabled={!latestJob} />}
      />

      <FilterChips className={styles.chips} label="Filter applications by status" options={FILTERS} value={filter} onChange={setFilter} />

      <div className={styles.table}>
        {rows.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title={filter === 'all' ? 'No applications yet' : `No ${FILTERS.find((item) => item.id === filter).label.toLowerCase()} applications`}
            description={filter === 'all' ? 'Apply to a role and it will show up here with its status.' : 'Applications with this status will appear here.'}
            action={
              <Button as={Link} to="/candidate/jobs">
                Find jobs
              </Button>
            }
          />
        ) : (
          <DataTable caption="Your applications" columns={columns} rows={rows} getRowKey={(row) => row.id} />
        )}
      </div>

      <ApplicationActivityModal
        application={activity}
        job={activity ? getJob(activity.jobId) : undefined}
        onClose={() => setActivityId(null)}
        onWithdraw={(application) => {
          setActivityId(null)
          setWithdrawing(application)
        }}
      />
      <ConfirmDialog
        open={withdrawing !== null}
        title="Withdraw this application?"
        description={withdrawing ? `You’ll no longer be considered for ${getJob(withdrawing.jobId)?.title}. You can apply again later.` : undefined}
        confirmLabel="Withdraw application"
        tone="danger"
        onClose={() => setWithdrawing(null)}
        onConfirm={() => {
          withdraw(withdrawing.id)
          setWithdrawing(null)
        }}
      />
      <AiJobSummaryModal job={latestJob} open={summaryOpen} onClose={() => setSummaryOpen(false)} applied={latestJob ? hasApplied(latestJob.id) : false} onApply={applyTo} />
    </div>
  )
}
