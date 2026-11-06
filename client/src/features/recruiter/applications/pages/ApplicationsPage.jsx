import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, FileText, Search } from 'lucide-react'
import { Avatar, Icon, SelectField, TextField } from '@/components/ui'
import DataTable from '@/components/common/DataTable.jsx'
import { tableState } from '@/components/common/tableState.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import InterviewStatus from '@/features/interviews/components/InterviewStatus.jsx'
import ScheduleInterviewButton from '@/features/interviews/components/ScheduleInterviewButton.jsx'
import UpcomingInterviews from '@/features/interviews/components/UpcomingInterviews.jsx'
import { useMarkSeen } from '@/features/notifications/api.js'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'
import { useFormat } from '@/lib/preferences.js'
import { foldText } from '@/lib/text.js'
import { useGetCompanyApplicationQuery, useGetCompanyApplicationsQuery, useGetPipelineQuery } from '../api.js'
import ApplicationStageSelect from '../components/ApplicationStageSelect.jsx'
import styles from './ApplicationsPage.module.css'

const profilePath = (candidateId) => `/recruiter/find-candidates/${candidateId}`
const STATUS_FILTERS = ['not_selected', 'withdrawn']

/**
 * Applications (M-076, M-077, M-090): one row per application with the job and the applied date, a job filter,
 * a stage filter with "Not selected" and "Withdrawn", a stage select per row and a confirmed rejection.
 * `?jobId=` opens it filtered (the job details link). /recruiter/applications/:applicationId (a notification, P11b-Q9)
 * filters it to that application's job and status and highlights the row; an unknown id says it is no longer available.
 */
export default function ApplicationsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const jobId = params.get('jobId') ?? ''
  const stageFilter = params.get('stage') ?? ''
  const status = STATUS_FILTERS.includes(stageFilter) ? stageFilter : undefined
  const result = useGetCompanyApplicationsQuery({ ...(jobId && { jobId }), ...(status ? { status } : stageFilter && { stageId: stageFilter }) })
  const { data } = result
  const table = tableState(result, data?.items ?? [])
  const { data: pipeline } = useGetPipelineQuery()
  const { data: jobs } = useGetRecruiterJobsQuery()
  const stages = pipeline?.items ?? []
  const focusId = useParams().applicationId
  const { data: focus, isError: focusMissing } = useGetCompanyApplicationQuery(focusId, { skip: !focusId })
  useMarkSeen('application', focus?.id)

  // Once per opened application: the list shows its job and, for a closed one, its status.
  const filtered = useRef(null)
  useEffect(() => {
    if (!focus || filtered.current === focus.id) return
    filtered.current = focus.id
    const next = new URLSearchParams()
    next.set('jobId', focus.job.id)
    if (STATUS_FILTERS.includes(focus.status)) next.set('stage', focus.status)
    setParams(next, { replace: true })
  }, [focus, setParams])

  const focusShown = Boolean(focus && data?.items.some((row) => row.id === focus.id))
  useEffect(() => {
    if (focusShown) document.querySelector(`[data-application-row="${focus.id}"]`)?.scrollIntoView({ block: 'center' })
  }, [focusShown, focus?.id])

  function setFilter(name, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  const jobOptions = [{ value: '', label: t('applications:recruiter.allJobs') }, ...(jobs?.items ?? []).filter((job) => job.status !== 'draft').map((job) => ({ value: job.id, label: job.title }))]
  const stageOptions = [
    { value: '', label: t('applications:recruiter.allStages') },
    ...stages.map((stage) => ({ value: stage.id, label: stage.name })),
    { value: 'not_selected', label: t('applications:recruiter.notSelectedFilter', { count: data?.counts.not_selected ?? 0 }) },
    { value: 'withdrawn', label: t('applications:recruiter.withdrawnFilter', { count: data?.counts.withdrawn ?? 0 }) },
  ]
  const needle = foldText(query.trim())
  const rows = (data?.items ?? []).filter((row) => !needle || foldText(`${row.candidate.fullName} ${row.candidate.headline} ${row.job.title}`).includes(needle))

  const columns = [
    {
      key: 'candidate',
      header: t('applications:recruiter.candidate'),
      skeleton: 'avatar',
      width: '26%',
      render: (row) => (
        <Link to={profilePath(row.candidate.id)} className={styles.candidate}>
          <Avatar name={row.candidate.fullName} src={row.candidate.photoUrl ?? undefined} size={36} className={styles.avatar} />
          <span>
            <span className={styles.name}>{row.candidate.fullName}</span>
            <span className={styles.headline}>{row.candidate.headline}</span>
          </span>
        </Link>
      ),
    },
    { key: 'job', header: t('applications:recruiter.job'), width: '25%', render: (row) => <span className={styles.cell}>{row.job.title}</span> },
    { key: 'applied', header: t('applications:recruiter.applied'), width: '14%', render: (row) => <span className={styles.cell}>{format.date(row.appliedAt)}</span> },
    {
      key: 'stage',
      header: t('applications:recruiter.stage'),
      skeleton: 'action',
      width: '22%',
      render: (row) => (
        <div className={styles.stageCell}>
          <ApplicationStageSelect
            application={row}
            stages={stages}
            candidateName={row.candidate.fullName}
            jobTitle={row.job.title}
            label={t('applications:recruiter.stageLabel', { name: row.candidate.fullName })}
          />
          {/* P11d-A6: the latest interview and scheduling from the row. */}
          <InterviewStatus interview={row.interview} />
          <ScheduleInterviewButton application={row} compact />
        </div>
      ),
    },
    {
      key: 'profile',
      header: <span className="sr-only">{t('applications:recruiter.profile')}</span>,
      render: (row) => (
        <Link to={profilePath(row.candidate.id)} className={styles.profileLink} aria-label={t('applications:recruiter.viewProfile', { name: row.candidate.fullName })}>
          <Icon as={ArrowUpRight} size={15} />
        </Link>
      ),
    },
  ]

  const nothingYet = data && !jobId && !stageFilter && data.counts.active + data.counts.not_selected + data.counts.withdrawn === 0

  return (
    <div>
      <PageTitle title={t('applications:recruiter.title')} description={t('applications:recruiter.description')} />
      {focusMissing && <NoticeBanner>{t('notifications:unavailable')}</NoticeBanner>}
      <UpcomingInterviews />

      <div className={styles.filters}>
        <TextField variant="filter"
          className={styles.search}
          type="search"
          aria-label={t('applications:recruiter.search')}
          placeholder={t('applications:recruiter.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField variant="filter" className={styles.stageFilter} aria-label={t('applications:recruiter.jobFilter')} name="jobId" options={jobOptions} value={jobId} onChange={(event) => setFilter('jobId', event.target.value)} />
        <SelectField variant="filter" className={styles.stageFilter} aria-label={t('applications:recruiter.stageFilter')} name="stage" options={stageOptions} value={stageFilter} onChange={(event) => setFilter('stage', event.target.value)} />
      </div>

      <div className={styles.table}>
        {table.loading || rows.length > 0 ? (
          <DataTable
            loading={table.loading}
            busy={table.busy}
            caption={t('applications:recruiter.caption')}
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            getRowProps={(row) => ({ 'data-application-row': row.id, ...(row.id === focus?.id && { className: styles.focused, 'aria-current': 'true' }) })}
          />
        ) : !data ? null : nothingYet ? (
          <EmptyState icon={FileText} title={t('applications:recruiter.noApplications')} description={t('applications:recruiter.noApplicationsText')} />
        ) : (
          <EmptyState icon={Search} title={t('applications:recruiter.empty')} description={t('applications:recruiter.emptyText')} />
        )}
      </div>
    </div>
  )
}
