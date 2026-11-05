import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Users } from 'lucide-react'
import { can } from '@/app/permissions.js'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import DataTable, { tableState } from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Avatar, Button, Icon, SelectField, TextField } from '@/components/ui'
import { useCountryOptions } from '@/lib/countries.js'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetAdminUsersQuery } from '../api.js'
import { STATE_TONES, STATUS_TONES, VERIFICATION_TONES } from '../tones.js'
import styles from './UsersDirectory.module.css'

const FILTERS = {
  candidate: ['status', 'country', 'verification', 'plan', 'rightToWork'],
  recruiter: ['state', 'country', 'plan'],
}
const OPTIONS = {
  status: ['active', 'unverified'],
  state: ['pending', 'approved', 'rejected', 'suspended'],
  verification: ['not_started', 'in_review', 'partial', 'verified'],
  // The plan filter offers the role's plans (P11c-Q17).
  plan: { candidate: ['free', 'plus'], recruiter: ['free', 'recruiter_plus'] },
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
  const { params, setFilter, search, setSearch, clearFilters } = useUrlFilters()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const filters = Object.fromEntries(['q', ...FILTERS[role]].map((name) => [name, params.get(name) ?? '']))
  const page = Number(params.get('page')) || 1
  const query = { role, page, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }
  const result = useGetAdminUsersQuery(query, { refetchOnMountOrArgChange: true })
  const { data, isSuccess } = result
  const table = tableState(result, data?.items ?? [])
  const listPath = workspacePath(WORKSPACES.admin, `${role}s`)

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
    skeleton: 'avatar',
    render: (row) => (
      <div className={styles.user}>
        <Avatar name={row.fullName} src={row.photoUrl ?? undefined} size={32} />
        <div className={styles.userText}>
          <p className={styles.name}>{row.fullName}</p>
          <p className={styles.email} title={row.email}>
            {row.email}
          </p>
        </div>
      </div>
    ),
  }
  const muted = (text) => <span className={styles.muted}>{text}</span>
  // Two-line cells (LinkedIn-style): the main value, then a quieter second line.
  // Short second lines stay on one line; `wrap` lets a long one (right to work) wrap.
  const stack = (main, sub, wrap = false) => (
    <div className={styles.stack}>
      {main}
      <span className={cx(styles.sub, wrap && styles.subWrap)}>{sub}</span>
    </div>
  )
  const country = (row) => <span className={styles.main}>{row.country ? format.country(row.country) : t('noCountry')}</span>
  const rightToWork = (row) =>
    row.rightToWork
      .filter((entry) => entry.valid)
      .map((entry) => `${t(`enums:rtwRegion.${entry.region}`)} · ${t(`enums:rtwStatus.${entry.status}`)}`)
      .join(', ') || t('noRightToWork')
  const plan = { key: 'plan', header: t('columns.plan'), skeleton: 'pill', render: (row) => <PillBadge tone={row.plan === 'free' ? 'neutral' : 'accent'}>{t(`enums:planKey.${row.plan}`)}</PillBadge> }
  const columns = [
    user,
    ...(role === 'recruiter' ? [{ key: 'company', header: t('columns.company'), render: (row) => muted(row.company?.displayName ?? t('noCountry')) }] : []),
    role === 'candidate'
      ? { key: 'location', header: t('columns.location'), render: (row) => stack(country(row), t('rightToWorkLine', { value: rightToWork(row) }), true) }
      : { key: 'country', header: t('columns.country'), render: country },
    ...(role === 'candidate'
      ? [
          {
            key: 'profile',
            header: t('columns.profile'),
            render: (row) =>
              stack(
                <PillBadge tone={VERIFICATION_TONES[row.verification.state]}>{t(`verificationState.${row.verification.state}`, { count: row.verification.count })}</PillBadge>,
                t('profileComplete', { percent: format.number(row.completeness / 100, { style: 'percent' }) }),
              ),
          },
          plan,
        ]
      : [plan]),
    {
      key: 'learning',
      header: t('columns.learning'),
      render: (row) => stack(<span className={styles.main}>{t('courses', { count: row.learning.enrolled })}</span>, t('certificates', { count: row.learning.certificates })),
    },
    {
      key: 'status',
      header: t('columns.status'),
      skeleton: 'pill',
      render: (row) =>
        stack(
          role === 'candidate' ? (
            <PillBadge tone={STATUS_TONES[row.status] ?? 'neutral'} dot>
              {t(`enums:userStatus.${row.status}`)}
            </PillBadge>
          ) : (
            <PillBadge tone={STATE_TONES[row.state]} dot>
              {t(`recruiterState.${row.state}`)}
            </PillBadge>
          ),
          t('joinedOn', { date: format.date(row.joinedAt) }),
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
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
              ...(name === 'country' ? countries.map((country) => ({ value: country.code, label: country.name })) : (name === 'plan' ? OPTIONS.plan[role] : OPTIONS[name]).map((value) => ({ value, label: optionLabel(name, value) }))),
            ]}
          />
        ))}
      </div>

      <div className={styles.results}>
        {table.loading || data?.items.length > 0 ? (
          <>
            <DataTable className={styles.table} loading={table.loading} busy={table.busy} caption={t(`caption.${role}`)} columns={columns} rows={data?.items ?? []} getRowKey={(row) => row.id} />
            {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => setFilter('page', String(next))} />}
          </>
        ) : (
          isSuccess && (
            <EmptyState
              icon={Users}
              title={t('empty')}
              description={t('emptyText')}
              action={
                <Button variant="outline" onClick={clearFilters}>
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
