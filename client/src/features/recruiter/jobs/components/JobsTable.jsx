import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, Settings2 } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { cx } from '@/utils/cx.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import { Dropdown, Icon, IconButton } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useJobText } from '@/lib/jobText.js'
import { useDeleteJobMutation, useSetJobStatusMutation } from '../api.js'
import { JOB_STEPS } from '../utils/jobForm.js'
import JobStatusBadge from './JobStatusBadge.jsx'
import styles from './JobsTable.module.css'

/** M-040: the status changes offered per status, as [target, label key]; closing asks for confirmation. */
const STATUS_ACTIONS = {
  published: [
    ['paused', 'paused'],
    ['closed', 'closed'],
  ],
  paused: [
    ['published', 'resume'],
    ['closed', 'closed'],
  ],
  draft: [['published', 'published']],
  closed: [['published', 'reopen']],
}

const COLUMNS = [
  { key: 'title', label: 'role', sortable: true },
  { key: 'workPreference', label: 'workPreference' },
  { key: 'relevantCount', label: 'candidates', sortable: true },
  { key: 'status', label: 'status', sortable: true },
]

function ColumnLabel({ column, sort, onSort }) {
  const { t } = useTranslation()
  const label = t(`jobs:table.${column.label}`)
  if (!column.sortable || !onSort) return label
  const active = sort?.key === column.key
  return (
    <button type="button" className={styles.sortButton} onClick={() => onSort(column.key)}>
      {label}
      {active && <Icon as={sort.direction === 'asc' ? ArrowUp : ArrowDown} size={11} />}
    </button>
  )
}

function ManageMenu({ job, onStatus, onRequestClose, onRequestDelete }) {
  const { t } = useTranslation()
  return (
    <Dropdown panelClassName={styles.menuPanel} trigger={(props) => <IconButton icon={Settings2} label={t('jobs:table.manage', { title: job.title })} {...props} />}>
      {({ close }) => (
        <ul className={styles.menu}>
          <li>
            <Link to={`/recruiter/jobs/${job.id}/edit`} className={styles.menuItem} onClick={close}>
              {t('jobs:table.edit')}
            </Link>
          </li>
          <li>
            <Link to={`/recruiter/find-candidates?jobId=${job.id}`} className={styles.menuItem} onClick={close}>
              {t('jobs:table.viewCandidates')}
            </Link>
          </li>
          {STATUS_ACTIONS[job.status].map(([to, label]) => (
            <li key={to}>
              <button
                type="button"
                className={cx(styles.menuItem, to === 'closed' && styles.menuDanger)}
                onClick={() => {
                  close()
                  if (to === 'closed') onRequestClose(job)
                  else onStatus(job, to)
                }}
              >
                {t(`jobs:table.statusActions.${label}`)}
              </button>
            </li>
          ))}
          {/* M-038: only drafts can be deleted. */}
          {job.status === 'draft' && (
            <li>
              <button
                type="button"
                className={cx(styles.menuItem, styles.menuDanger)}
                onClick={() => {
                  close()
                  onRequestDelete(job)
                }}
              >
                {t('jobs:table.delete')}
              </button>
            </li>
          )}
        </ul>
      )}
    </Dropdown>
  )
}

/**
 * Roles table shared by Jobs and the Overview ("Your open roles"). Pass `sort` + `onSort(key)` to make the
 * Role / Candidates / Status headers sortable. Publishing an incomplete draft opens the wizard at the first
 * invalid step (M-039).
 */
export default function JobsTable({ jobs, sort, onSort, caption }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const jobText = useJobText()
  const [setJobStatus] = useSetJobStatusMutation()
  const [deleteJob] = useDeleteJobMutation()
  const [closing, setClosing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [failure, setFailure] = useState(null)

  async function changeStatus(job, status) {
    setFailure(null)
    try {
      await setJobStatus({ id: job.id, status }).unwrap()
    } catch (error) {
      const step = error.data?.error?.params?.step
      if (errorCode(error) === 'VALIDATION_FAILED' && step) navigate(`/recruiter/jobs/${job.id}/edit?step=${JOB_STEPS.indexOf(step)}&publish=1`)
      else setFailure(errorCode(error) === 'LOCKED' ? t('jobs:table.locked') : errorText.code(error))
    }
  }

  return (
    <div className={styles.card}>
      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
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
                <th key={column.key} scope="col" className={styles.th} aria-sort={sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <ColumnLabel column={column} sort={sort} onSort={onSort} />
                </th>
              ))}
              <th scope="col" className={styles.th}>
                <span className="sr-only">{t('jobs:table.actions')}</span>
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
                  <p className={styles.roleMeta}>{[jobText.place(job), job.employmentType && t(`enums:employmentType.${job.employmentType}`)].filter(Boolean).join(' · ')}</p>
                </td>
                <td className={cx(styles.td, styles.muted)}>{job.workPreference && t(`enums:workPreference.${job.workPreference}`)}</td>
                <td className={styles.td}>
                  <Link to={`/recruiter/find-candidates?jobId=${job.id}`} className={styles.relevant}>
                    {t('jobs:table.relevant', { count: job.relevantCount })}
                  </Link>
                </td>
                <td className={styles.td}>
                  <JobStatusBadge status={job.status} restricted={Boolean(job.restricted)} />
                </td>
                <td className={styles.td}>
                  <div className={styles.actions}>
                    <ManageMenu job={job} onStatus={changeStatus} onRequestClose={setClosing} onRequestDelete={setDeleting} />
                    <IconButton as={Link} to={`/recruiter/jobs/${job.id}`} icon={Eye} label={t('jobs:table.view', { title: job.title })} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(closing)}
        title={t('jobs:table.closeTitle')}
        description={closing ? t('jobs:table.closeText', { title: closing.title }) : undefined}
        confirmLabel={t('jobs:table.statusActions.closed')}
        tone="danger"
        onClose={() => setClosing(null)}
        onConfirm={() => {
          changeStatus(closing, 'closed')
          setClosing(null)
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('jobs:table.deleteTitle')}
        description={deleting ? t('jobs:table.deleteText', { title: deleting.title }) : undefined}
        confirmLabel={t('jobs:table.delete')}
        tone="danger"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const job = deleting
          setDeleting(null)
          try {
            await deleteJob(job.id).unwrap()
          } catch (error) {
            setFailure(errorText.code(error))
          }
        }}
      />
    </div>
  )
}
