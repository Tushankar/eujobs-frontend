import { Download, FileText } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon } from '@/components/ui'
import { downloadCsv } from '@/utils/downloadCsv.js'
import { APPLICATION_STATUS, SAMPLE_APPLICATIONS as rows } from '../data/applications.js'
import styles from './ApplicationsPage.module.css'

const COLUMNS = [
  { key: 'candidate', header: 'Candidate', render: (row) => <span className={styles.strong}>{row.candidate}</span> },
  { key: 'role', header: 'Role', render: (row) => <span className={styles.muted}>{row.role}</span> },
  { key: 'company', header: 'Company', render: (row) => <span className={styles.muted}>{row.company}</span> },
  { key: 'applied', header: 'Applied', render: (row) => <span className={styles.muted}>{row.appliedAt}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <PillBadge tone={APPLICATION_STATUS[row.status].tone}>{APPLICATION_STATUS[row.status].label}</PillBadge>,
  },
]

export default function ApplicationsPage() {
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
