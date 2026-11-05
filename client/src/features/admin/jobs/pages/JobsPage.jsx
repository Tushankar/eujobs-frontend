import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BriefcaseBusiness, FolderOpen, RotateCcw } from 'lucide-react'
import { can } from '@/app/permissions.js'
import DataTable from '@/components/common/DataTable.jsx'
import { tableState } from '@/components/common/tableState.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon, Modal, SelectField, TextareaField, TextField } from '@/components/ui'
import CompanyCell from '@/components/common/CompanyCell.jsx'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import JobSummaryDialog from '@/features/ai/components/JobSummaryDialog.jsx'
import JobStatusBadge from '@/features/recruiter/jobs/components/JobStatusBadge.jsx'
import { useCountryOptions } from '@/lib/countries.js'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { useGetAdminJobSummaryQuery, useGetAdminJobsQuery, useOpenJobCaseMutation, useRegenerateAdminJobSummaryMutation } from '../api.js'
import styles from './JobsPage.module.css'

const STATUSES = ['published', 'paused', 'draft', 'closed']
const REASONS = ['spam', 'scam_or_fraud', 'discriminatory', 'offensive', 'misleading', 'other']

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

/** "Open case" (M-164, OQ-1): the admin names a reason; the case opens in Moderation. An open case is reused. */
function OpenCaseDialog({ job, onClose }) {
  const { t } = useTranslation(['adminJobs', 'enums'])
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [openCase, { isLoading }] = useOpenJobCaseMutation()
  const { values, set, errors, failure, run } = useFormState({ reason: '', details: '' })
  async function submit(event) {
    event.preventDefault()
    let caseId
    const done = await run({ reason: check.required(values.reason), details: check.maxLength(values.details, 500) }, async () => {
      caseId = (await openCase({ id: job.id, reason: values.reason, details: values.details.trim() }).unwrap()).id
    })
    if (done) navigate(`/admin/moderation/content/${caseId}`)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('openCase.title', { title: job.title })}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('openCase.cancel')}
          </Button>
          <Button type="submit" form="open-case-form" loading={isLoading}>
            {t('openCase.submit')}
          </Button>
        </>
      }
    >
      <form id="open-case-form" className={styles.caseForm} onSubmit={submit} noValidate>
        <p className={styles.caseIntro}>{t('openCase.intro')}</p>
        <SelectField
          name="reason"
          label={t('openCase.reason')}
          value={values.reason}
          onChange={(event) => set('reason', event.target.value)}
          error={errorText.field('reason', errors.reason)}
          options={[{ value: '', label: t('openCase.chooseReason') }, ...REASONS.map((reason) => ({ value: reason, label: t(`enums:reportReason.${reason}`) }))]}
        />
        <TextareaField name="details" label={t('openCase.details')} value={values.details} onChange={(event) => set('details', event.target.value)} error={errorText.field('details', errors.details)} rows={3} />
        {failure && (
          <p className={styles.error} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </Modal>
  )
}

/**
 * Admin > Jobs (M-046, P9-Q5, P10-Q4, P10-Q15): every job of every status from the server, with status and country
 * filters, a search in title and company, pages, the AI summary and "Open case" (none on drafts, P10-Q4).
 */
export default function JobsPage() {
  const { t } = useTranslation(['adminJobs', 'enums'])
  const { jobId } = useParams()
  const { search: query } = useLocation()
  const navigate = useNavigate()
  const format = useFormat()
  const { me } = usePreferences()
  const countries = useCountryOptions()
  const { params, setFilter, search, setSearch, clearFilters } = useUrlFilters()
  const filters = Object.fromEntries(['q', 'status', 'country'].map((name) => [name, params.get(name) ?? '']))
  const request = { page: Number(params.get('page')) || 1, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }
  const result = useGetAdminJobsQuery(request, { refetchOnMountOrArgChange: true })
  const { data, isSuccess } = result
  const [caseJob, setCaseJob] = useState(null)
  const jobs = data?.items ?? []
  const table = tableState(result, jobs)
  const summaryJob = jobId ? jobs.find((job) => job.id === jobId) : undefined
  const moderates = can(me, 'moderation.manage')
  const filtered = Object.values(filters).some(Boolean)

  const columns = [
    { key: 'title', header: t('columns.role'), width: 220, skeleton: 'text', render: (job) => <span className={styles.title}>{job.title}</span> },
    { key: 'company', header: t('columns.company'), width: 160, skeleton: 'logo', render: (job) => <CompanyCell name={job.company.displayName} id={job.company.id} logoUrl={job.company.logoUrl} /> },
    { key: 'country', header: t('columns.country'), width: 120, render: (job) => <span className={styles.muted}>{job.country ? format.country(job.country) : '—'}</span> },
    { key: 'salary', header: t('columns.salary'), width: 150, render: (job) => <span className={styles.muted}>{job.salary ? format.salary(job.salary) : '—'}</span> },
    { key: 'status', header: t('columns.status'), width: 110, skeleton: 'pill', render: (job) => <JobStatusBadge status={job.status} restricted={Boolean(job.restricted)} /> },
    {
      key: 'actions',
      width: 250,
      header: <span className="sr-only">{t('columns.actions')}</span>,
      render: (job) =>
        job.status !== 'draft' && (
          <div className={styles.actions} data-admin-job={job.id}>
            <Button
              as={Link}
              to={`/admin/jobs/${job.id}/ai-summary${query}`}
              variant="ghost"
              className={styles.summaryLink}
              leftIcon={<img src={aiSparkle} alt="" width={16} height={16} />}
              aria-label={t('summaryFor', { title: job.title })}
            >
              {t('summary')}
            </Button>
            {moderates &&
              (job.openCaseId ? (
                <RowActionLink to={`/admin/moderation/content/${job.openCaseId}`} aria-label={t('viewCaseFor', { title: job.title })}>
                  {t('viewCase')}
                </RowActionLink>
              ) : (
                <Button variant="outline" size="sm" leftIcon={<Icon as={FolderOpen} size={13} />} onClick={() => setCaseJob(job)} aria-label={t('openCaseFor', { title: job.title })} data-open-case>
                  {t('openCase.button')}
                </Button>
              ))}
          </div>
        ),
    },
  ]

  return (
    <>
      <PageTitle title={t('title')} description={t('description')} />
      <div className={styles.toolbar}>
        <TextField variant="filter" type="search" name="q" aria-label={t('search')} placeholder={t('search')} className={styles.search} value={search} onChange={(event) => setSearch(event.target.value)} />
        <SelectField variant="filter"
          name="status"
          className={styles.select}
          aria-label={t('filters.status')}
          value={filters.status}
          onChange={(event) => setFilter('status', event.target.value)}
          options={[{ value: '', label: t('filters.allStatuses') }, ...STATUSES.map((status) => ({ value: status, label: t(`enums:jobStatus.${status}`) }))]}
        />
        <SelectField variant="filter"
          name="country"
          className={styles.select}
          aria-label={t('filters.country')}
          value={filters.country}
          onChange={(event) => setFilter('country', event.target.value)}
          options={[{ value: '', label: t('filters.allCountries') }, ...countries.map((country) => ({ value: country.code, label: country.name }))]}
        />
      </div>
      <div className={styles.results}>
        {table.loading || jobs.length > 0 ? (
          <>
            <DataTable className={styles.table} loading={table.loading} busy={table.busy} caption={t('caption')} columns={columns} rows={jobs} getRowKey={(job) => job.id} />
            {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => setFilter('page', String(next))} />}
          </>
        ) : (
          isSuccess && (
            <EmptyState
              icon={BriefcaseBusiness}
              title={t(filtered ? 'emptyFiltered' : 'empty')}
              description={t(filtered ? 'emptyFilteredText' : 'emptyText')}
              action={
                filtered && (
                  <Button variant="outline" onClick={clearFilters}>
                    {t('clear')}
                  </Button>
                )
              }
            />
          )
        )}
      </div>
      {summaryJob && <AdminJobSummary key={summaryJob.id} job={summaryJob} onClose={() => navigate(`/admin/jobs${query}`)} />}
      {caseJob && <OpenCaseDialog job={caseJob} onClose={() => setCaseJob(null)} />}
    </>
  )
}
