import { Download, FileText } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon } from '@/components/ui'
import { downloadCsv } from '@/utils/downloadCsv.js'
import { APPLICATION_STATUS } from '@/features/candidate/jobs/data/applications.js'
import { useApplications } from '@/features/candidate/jobs/hooks/useApplications.js'
import { useJobListings } from '@/features/candidate/jobs/hooks/useJobListings.js'
import { ADMIN_USERS } from '../../shared/data/users.js'
import styles from './ApplicationsPage.module.css'

/** Every application in this demo marketplace belongs to the demo candidate. */
const APPLICANT = ADMIN_USERS.find((user) => user.id === 'alex-morgan').name

const STATUS_TONES = { applied: 'accent', 'under-review': 'accent', interview: 'success', withdrawn: 'neutral' }

const COLUMNS = [
  { key: 'candidate', header: 'Candidate', render: (row) => <span className={styles.strong}>{row.candidate}</span> },
  { key: 'role', header: 'Role', render: (row) => <span className={styles.muted}>{row.role}</span> },
  { key: 'company', header: 'Company', render: (row) => <span className={styles.muted}>{row.company}</span> },
  { key: 'applied', header: 'Applied', render: (row) => <span className={styles.muted}>{row.appliedAt}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <PillBadge tone={STATUS_TONES[row.status]}>{APPLICATION_STATUS[row.status].label}</PillBadge>,
  },
]

export default function ApplicationsPage() {
  const { applications } = useApplications()
  const { getJob } = useJobListings()

  const rows = applications.flatMap((application) => {
    const job = getJob(application.jobId)
    return job
      ? [{ id: application.id, candidate: APPLICANT, role: job.title, company: job.company, appliedAt: application.appliedAt, status: application.status }]
      : []
  })

  function exportActivity() {
    downloadCsv(
      [
        ['Candidate', 'Role', 'Company', 'Applied', 'Status'],
        ...rows.map((row) => [row.candidate, row.role, row.company, row.appliedAt, APPLICATION_STATUS[row.status].label]),
      ],
      'applications.csv',
    )
  }

  return (
    <>
      <PageTitle
        title="Connections, with context."
        description="Understand application activity without losing sight of the people behind it."
        actions={
          <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={exportActivity} disabled={rows.length === 0}>
            Export activity
          </Button>
        }
      />

      <div className={styles.results}>
        {rows.length > 0 ? (
          <DataTable className={styles.table} caption="Applications" columns={COLUMNS} rows={rows} getRowKey={(row) => row.id} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No applications yet"
            description="Applications submitted by candidates appear here."
          />
        )}
      </div>
    </>
  )
}
