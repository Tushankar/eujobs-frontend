import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, Settings2 } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import { Dropdown, Icon, IconButton } from '@/components/ui'
import JobStatusBadge from './JobStatusBadge.jsx'
import styles from './JobsTable.module.css'

/** Status changes offered per current status: [{ to, label }]. Closing asks for confirmation. */
const STATUS_ACTIONS = {
  published: [
    { to: 'paused', label: 'Pause job' },
    { to: 'closed', label: 'Close job' },
  ],
  paused: [
    { to: 'published', label: 'Resume publishing' },
    { to: 'closed', label: 'Close job' },
  ],
  draft: [{ to: 'published', label: 'Publish job' }],
  closed: [{ to: 'published', label: 'Reopen job' }],
}

const COLUMNS = [
  { key: 'title', label: 'Role', sortable: true },
  { key: 'workPreference', label: 'Work preference' },
  { key: 'relevant', label: 'Candidates', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
]

function ColumnLabel({ column, sort, onSort }) {
  if (!column.sortable || !onSort) return column.label
  const active = sort?.key === column.key
  return (
    <button type="button" className={styles.sortButton} onClick={() => onSort(column.key)}>
      {column.label}
      {active && <Icon as={sort.direction === 'asc' ? ArrowUp : ArrowDown} size={11} />}
    </button>
  )
}

function ManageMenu({ job, onStatusChange, onRequestClose }) {
  return (
    <Dropdown
      panelClassName={styles.menuPanel}
      trigger={(props) => <IconButton icon={Settings2} label={`Manage ${job.title}`} {...props} />}
    >
      {({ close }) => (
        <ul className={styles.menu}>
          <li>
            <Link to={`/recruiter/jobs/${job.id}/edit`} className={styles.menuItem} onClick={close}>
              Edit job
            </Link>
          </li>
          <li>
            <Link to="/recruiter/find-candidates" className={styles.menuItem} onClick={close}>
              View candidates
            </Link>
          </li>
          {STATUS_ACTIONS[job.status].map((action) => (
            <li key={action.to}>
              <button
                type="button"
                className={cx(styles.menuItem, action.to === 'closed' && styles.menuDanger)}
                onClick={() => {
                  close()
                  if (action.to === 'closed') onRequestClose(job)
                  else onStatusChange(job.id, action.to)
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dropdown>
  )
}

/**
 * Roles table shared by Jobs and the Overview ("Your open roles"). Pass `sort` + `onSort(key)` to make the
 * Role / Candidates / Status headers sortable; `onStatusChange(jobId, status)` powers the manage menu.
 */
export default function JobsTable({ jobs, onStatusChange, sort, onSort, caption = 'Roles' }) {
  const [closing, setClosing] = useState(null)

  return (
    <div className={styles.card}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col style={{ width: '29.2%' }} />
            <col style={{ width: '19%' }} />
            <col style={{ width: '15.5%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18.3%' }} />
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={styles.th}
                  aria-sort={
                    sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  <ColumnLabel column={column} sort={sort} onSort={onSort} />
                </th>
              ))}
              <th scope="col" className={styles.th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className={styles.row}>
                <td className={styles.td}>
                  <Link to={`/recruiter/jobs/${job.id}`} className={styles.roleTitle}>
                    {job.title}
                  </Link>
                  <p className={styles.roleMeta}>
                    {job.location} · {job.employmentType}
                  </p>
                </td>
                <td className={cx(styles.td, styles.muted)}>{job.workPreference}</td>
                <td className={styles.td}>
                  <Link to="/recruiter/find-candidates" className={styles.relevant}>
                    {job.relevant} relevant
                  </Link>
                </td>
                <td className={styles.td}>
                  <JobStatusBadge status={job.status} />
                </td>
                <td className={styles.td}>
                  <div className={styles.actions}>
                    <ManageMenu job={job} onStatusChange={onStatusChange} onRequestClose={setClosing} />
                    <IconButton as={Link} to={`/recruiter/jobs/${job.id}`} icon={Eye} label={`View ${job.title}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(closing)}
        title="Close this job?"
        description={
          closing ? `${closing.title} will stop accepting new candidates. You can reopen it at any time.` : undefined
        }
        confirmLabel="Close job"
        tone="danger"
        onClose={() => setClosing(null)}
        onConfirm={() => {
          onStatusChange(closing.id, 'closed')
          setClosing(null)
        }}
      />
    </div>
  )
}
