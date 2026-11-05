import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, CompanyLogo, Icon } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import { useCompanyMessageStart } from '@/features/messages/api.js'
import { CompanyMessageDialog } from '@/features/messages/components/StartConversation.jsx'
import { useMarkSeen } from '@/features/notifications/api.js'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetApplicationsQuery, useWithdrawMutation } from '../api.js'
import ApplicationActivityModal from '../components/ApplicationActivityModal.jsx'
import ApplyFlow from '../components/ApplyFlow.jsx'
import { STATUS_TONES } from '../status.js'
import styles from './ApplicationsPage.module.css'

/**
 * Applications (§3.4): every application with its status, dated history (M-075) and next step, withdraw (M-074),
 * Apply again after a withdrawal (a new record; the old one stays withdrawn) and a message to the company (M-084).
 * /candidate/applications/:applicationId opens that activity dialog (P11b-Q9); an unknown id says it is no longer available.
 */
export default function ApplicationsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  const { data: config } = useGetConfigQuery()
  const { data } = useGetApplicationsQuery()
  const [withdraw] = useWithdrawMutation()
  const [filter, setFilter] = useState('all')
  // P11b-Q9: a notification's link opens the dialog; the layout remounts a page when its path changes, so in-page opens
  // keep local state and only closing a linked dialog goes back to the list's URL.
  const navigate = useNavigate()
  const { applicationId } = useParams()
  const [activityId, setActivityId] = useState(applicationId ?? null)
  const closeActivity = () => {
    setActivityId(null)
    if (applicationId) navigate('/candidate/applications', { replace: true })
  }
  const [withdrawing, setWithdrawing] = useState(null)
  const [reapplying, setReapplying] = useState(null)
  const [messaging, setMessaging] = useState(null)
  const startMessage = useCompanyMessageStart()

  const applications = data?.items ?? []
  const rows = applications.filter((application) => filter === 'all' || application.status === filter)
  const activity = applications.find((application) => application.id === activityId)
  useMarkSeen('application', activity?.id)
  const activeJobs = new Set(applications.filter((application) => application.status !== 'withdrawn').map((application) => application.job.id))
  const canReapply = (application) => application.status === 'withdrawn' && application.job.accepting && !activeJobs.has(application.job.id)
  const filters = [{ id: 'all', label: t('applications:list.all') }, ...(config?.enums.applicationStatus ?? []).map((status) => ({ id: status, label: t(`enums:applicationStatus.${status}`) }))]

  const columns = [
    {
      key: 'opportunity',
      header: t('applications:list.opportunity'),
      width: '34%',
      render: (row) => (
        <Link to={`/candidate/jobs/${row.job.id}`} className={styles.opportunity}>
          <CompanyLogo name={row.job.company.displayName} id={row.job.company.id} src={row.job.company.logoUrl ?? undefined} size={36} />
          <span>
            <span className={styles.title}>{row.job.title}</span>
            <span className={styles.sub}>{[row.job.company.displayName, jobText.place(row.job)].filter(Boolean).join(' · ')}</span>
          </span>
        </Link>
      ),
    },
    { key: 'applied', header: t('applications:list.applied'), width: '13%', render: (row) => <span className={styles.date}>{format.date(row.appliedAt)}</span> },
    {
      key: 'status',
      header: t('applications:list.status'),
      width: '16%',
      render: (row) => (
        <span data-status={row.status}>
          <StatusBadge tone={STATUS_TONES[row.status]}>{t(`enums:applicationStatus.${row.status}`)}</StatusBadge>
        </span>
      ),
    },
    {
      key: 'next',
      header: t('applications:list.nextStep'),
      render: (row) => (
        <span className={styles.next}>
          <span className={styles.nextText}>{t(`applications:nextStep.${row.status}`)}</span>
          <Button variant="ghost" className={styles.activity} rightIcon={<Icon as={ArrowRight} size={12} />} data-application={row.id} onClick={() => setActivityId(row.id)}>
            {t('applications:list.viewActivity')}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageTitle className={styles.pageTitle} title={t('applications:list.title')} description={t('applications:list.description')} />

      {data && applicationId && !applications.some((application) => application.id === applicationId) && <NoticeBanner>{t('notifications:unavailable')}</NoticeBanner>}

      <FilterChips className={styles.chips} label={t('applications:list.filtersLabel')} options={filters} value={filter} onChange={setFilter} />

      <div className={styles.table}>
        {!data ? null : rows.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title={t(filter === 'all' ? 'applications:list.empty' : 'applications:list.emptyFiltered')}
            description={t(filter === 'all' ? 'applications:list.emptyText' : 'applications:list.emptyFilteredText')}
            action={
              <Button as={Link} to="/candidate/jobs">
                {t('applications:list.findJobs')}
              </Button>
            }
          />
        ) : (
          <DataTable caption={t('applications:list.caption')} columns={columns} rows={rows} getRowKey={(row) => row.id} />
        )}
      </div>

      <ApplicationActivityModal
        application={activity}
        canReapply={activity ? canReapply(activity) : false}
        onClose={closeActivity}
        onWithdraw={(application) => {
          setActivityId(null)
          setWithdrawing(application)
        }}
        onReapply={(application) => {
          setActivityId(null)
          setReapplying(application)
        }}
        onMessage={(application) => {
          setActivityId(null)
          startMessage(() => setMessaging(application.job))
        }}
      />
      <ConfirmDialog
        open={withdrawing !== null}
        title={t('applications:withdraw.title')}
        description={withdrawing ? t('applications:withdraw.description', { title: withdrawing.job.title }) : undefined}
        confirmLabel={t('applications:withdraw.confirm')}
        tone="danger"
        onClose={() => setWithdrawing(null)}
        onConfirm={() => {
          withdraw(withdrawing.id)
          setWithdrawing(null)
        }}
      />
      {reapplying && <ApplyFlow job={reapplying.job} onClose={() => setReapplying(null)} />}
      {messaging && <CompanyMessageDialog job={messaging} onClose={() => setMessaging(null)} />}
    </div>
  )
}
