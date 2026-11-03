import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Download, Users } from 'lucide-react'
import { can } from '@/app/permissions.js'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import { useCountryOptions } from '@/lib/countries.js'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetAdminUsersQuery } from '../api.js'
import styles from './UsersDirectory.module.css'

const STATUS_TONES = { active: 'success', unverified: 'warning', invited: 'warning' }
const STATE_TONES = { pending: 'warning', approved: 'success', rejected: 'danger', suspended: 'danger' }
const VERIFICATION_TONES = { verified: 'success', partial: 'info', in_review: 'warning', not_started: 'neutral' }
const FILTERS = {
  candidate: ['status', 'country', 'verification', 'plan', 'rightToWork'],
  recruiter: ['state', 'country'],
}
const OPTIONS = {
  status: ['active', 'unverified'],
  state: ['pending', 'approved', 'rejected', 'suspended'],
  verification: ['not_started', 'in_review', 'partial', 'verified'],
  plan: ['free', 'plus'],
  rightToWork: ['eu', 'uk', 'none'],
}

/**
 * Admin › Candidates or Recruiters (M-161, M-169, M-206): server-paginated with the filters in the URL (the Overview's
 * Active users card links to ?status=active, U10), the country filter (M-138) and an audited CSV export built by the
 * server in the admin's language (OQ-6d; needs `reports.export`). "Manage" opens the detail page.
 */
export default function UsersDirectory({ role }) {
  const { t } = useTranslation(['adminUsers', 'enums'])
  const format = useFormat()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const countries = useCountryOptions().filter((country) => !country.isRemote)
  const [params, setParams] = useSearchParams()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const filters = Object.fromEntries(['q', ...FILTERS[role]].map((name) => [name, params.get(name) ?? '']))
  const page = Number(params.get('page')) || 1
  const query = { role, page, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }
  const { data, isSuccess } = useGetAdminUsersQuery(query, { refetchOnMountOrArgChange: true })
  const listPath = workspacePath(WORKSPACES.admin, `${role}s`)

  function setFilter(name, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      await downloadFromApi('/admin/users/export', { ...query, page: undefined })
    } catch (error) {
      setExportError(errorText.code(error))
    } finally {
      setExporting(false)
    }
  }

  const optionLabel = (name, value) => {
    if (name === 'status') return t(`enums:userStatus.${value}`)
    if (name === 'state') return t(`recruiterState.${value}`)
    if (name === 'verification') return value === 'partial' ? t('filters.partial') : t(`verificationState.${value}`)
    if (name === 'plan') return t(`enums:planKey.${value}`)
    return value === 'none' ? t('filters.noRightToWork') : t('filters.rightToWorkIn', { region: t(`enums:rtwRegion.${value}`) })
  }
  const allLabel = { status: 'allStatuses', state: 'allStatuses', country: 'allCountries', verification: 'allVerification', plan: 'allPlans', rightToWork: 'anyRightToWork' }

  const user = {
    key: 'user',
    header: t('columns.user'),
    render: (row) => (
      <>
        <p className={styles.name}>{row.fullName}</p>
        <p className={styles.email}>{row.email}</p>
      </>
    ),
  }
  const muted = (text) => <span className={styles.muted}>{text}</span>
  const columns = [
    user,
    { key: 'joined', header: t('columns.joined'), render: (row) => muted(format.date(row.joinedAt)) },
    ...(role === 'recruiter' ? [{ key: 'company', header: t('columns.company'), render: (row) => muted(row.company?.displayName ?? t('noCountry')) }] : []),
    { key: 'country', header: t('columns.country'), render: (row) => muted(row.country ? format.country(row.country) : t('noCountry')) },
    ...(role === 'candidate'
      ? [
          {
            key: 'rightToWork',
            header: t('columns.rightToWork'),
            render: (row) =>
              muted(row.rightToWork.filter((entry) => entry.valid).map((entry) => `${t(`enums:rtwRegion.${entry.region}`)} · ${t(`enums:rtwStatus.${entry.status}`)}`).join(', ') || t('noRightToWork')),
          },
          {
            key: 'verification',
            header: t('columns.verification'),
            render: ({ verification }) => <PillBadge tone={VERIFICATION_TONES[verification.state]}>{t(`verificationState.${verification.state}`, { count: verification.count })}</PillBadge>,
          },
          { key: 'completeness', header: t('columns.completeness'), render: (row) => muted(format.number(row.completeness / 100, { style: 'percent' })) },
          { key: 'plan', header: t('columns.plan'), render: (row) => <PillBadge tone={row.plan === 'plus' ? 'accent' : 'neutral'}>{t(`enums:planKey.${row.plan}`)}</PillBadge> },
        ]
      : []),
    { key: 'learning', header: t('columns.learning'), render: (row) => muted(t('learning', row.learning)) },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) =>
        role === 'candidate' ? (
          <PillBadge tone={STATUS_TONES[row.status] ?? 'neutral'} dot>
            {t(`enums:userStatus.${row.status}`)}
          </PillBadge>
        ) : (
          <PillBadge tone={STATE_TONES[row.state]} dot>
            {t(`recruiterState.${row.state}`)}
          </PillBadge>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('manage')}</span>,
      render: (row) => (
        <RowActionLink to={`${listPath}/${row.id}`} aria-label={t('manageLabel', { name: row.fullName })}>
          {t('manage')}
        </RowActionLink>
      ),
    },
  ]

  return (
    <>
      <PageTitle
        title={t(`${role}s.title`)}
        description={t(`${role}s.description`)}
        actions={
          can(me, 'reports.export') && (
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={exportCsv} loading={exporting} disabled={!data?.total}>
              {t('export')}
            </Button>
          )
        }
      />
      {exportError && (
        <p className={styles.error} role="alert">
          {exportError}
        </p>
      )}

      <div className={styles.toolbar}>
        <TextField
          type="search"
          name="q"
          aria-label={t('search')}
          placeholder={t('search')}
          className={styles.search}
          value={filters.q}
          onChange={(event) => setFilter('q', event.target.value)}
        />
        {FILTERS[role].map((name) => (
          <SelectField
            key={name}
            name={name}
            aria-label={t(`filters.${name}`)}
            className={styles.filter}
            value={filters[name]}
            onChange={(event) => setFilter(name, event.target.value)}
            options={[
              { value: '', label: t(`filters.${allLabel[name]}`) },
              ...(name === 'country' ? countries.map((country) => ({ value: country.code, label: country.name })) : OPTIONS[name].map((value) => ({ value, label: optionLabel(name, value) }))),
            ]}
          />
        ))}
      </div>

      <div className={styles.results}>
        {data?.items.length > 0 ? (
          <>
            <DataTable className={styles.table} caption={t(`caption.${role}`)} columns={columns} rows={data.items} getRowKey={(row) => row.id} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => setFilter('page', String(next))} />
          </>
        ) : (
          isSuccess && (
            <EmptyState
              icon={Users}
              title={t('empty')}
              description={t('emptyText')}
              action={
                <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                  {t('filters.clear')}
                </Button>
              }
            />
          )
        )}
      </div>
    </>
  )
}
