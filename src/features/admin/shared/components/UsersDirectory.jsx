import { useState } from 'react'
import { Download, Users } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import { downloadCsv } from '@/utils/downloadCsv.js'
import { USER_STATUSES, formatJoined } from '../data/users.js'
import styles from './UsersDirectory.module.css'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...Object.entries(USER_STATUSES).map(([value, { label }]) => ({ value, label })),
]

const COLUMNS = [
  {
    key: 'user',
    header: 'User',
    render: (user) => (
      <>
        <p className={styles.name}>{user.name}</p>
        <p className={styles.email}>{user.email}</p>
      </>
    ),
  },
  { key: 'role', header: 'Role', render: (user) => <span className={styles.muted}>{user.role}</span> },
  { key: 'joined', header: 'Joined', render: (user) => <span className={styles.muted}>{formatJoined(user.joined)}</span> },
  {
    key: 'verification',
    header: 'Verification',
    render: ({ verification }) =>
      verification.badge ? (
        <PillBadge>{verification.label}</PillBadge>
      ) : (
        <span className={styles.muted}>{verification.label}</span>
      ),
  },
  { key: 'learning', header: 'Learning', render: (user) => <span className={styles.muted}>{user.learning || '—'}</span> },
  {
    key: 'status',
    header: 'Status',
    render: ({ status }) => (
      <PillBadge tone={USER_STATUSES[status].tone} dot>
        {USER_STATUSES[status].label}
      </PillBadge>
    ),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    render: (user) => (
      <RowActionLink to={`/admin/access-management/users/${user.id}`} aria-label={`Manage ${user.name}`}>
        Manage
      </RowActionLink>
    ),
  },
]

/**
 * Admin account list (Candidates / Recruiters): title block with CSV export, name/email search,
 * status filter and the accounts table. `users` are already limited to the role being shown.
 */
export default function UsersDirectory({ title, description, users, filename }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  const needle = query.trim().toLowerCase()
  const rows = users.filter(
    (user) =>
      (status === 'all' || user.status === status) &&
      (!needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)),
  )

  function clearFilters() {
    setQuery('')
    setStatus('all')
  }

  function exportUsers() {
    downloadCsv(
      [
        ['Name', 'Email', 'Role', 'Joined', 'Verification', 'Learning', 'Status'],
        ...rows.map((user) => [
          user.name,
          user.email,
          user.role,
          user.joined,
          user.verification.label,
          user.learning || '',
          USER_STATUSES[user.status].label,
        ]),
      ],
      filename,
    )
  }

  return (
    <>
      <PageTitle
        title={title}
        description={description}
        actions={
          <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={exportUsers} disabled={rows.length === 0}>
            Export users
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <TextField
          type="search"
          aria-label="Search names or email addresses"
          placeholder="Search names or email addresses"
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField
          aria-label="Filter by status"
          className={styles.filter}
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        />
      </div>

      <div className={styles.results}>
        {rows.length > 0 ? (
          <DataTable
            className={styles.table}
            caption={title}
            columns={COLUMNS}
            rows={rows}
            getRowKey={(user) => user.id}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No accounts match"
            description="Try a different name or email address, or show every status."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}
