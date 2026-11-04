import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { can } from '@/app/permissions.js'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import { useCountryOptions } from '@/lib/countries.js'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { useGetAdminApplicationsQuery } from '../api.js'
import styles from './ApplicationsPage.module.css'

const STATUSES = ['applied', 'under_review', 'interview', 'offer', 'hired', 'not_selected', 'withdrawn']
const TONES = { applied: 'accent', under_review: 'accent', interview: 'success', offer: 'success', hired: 'success', not_selected: 'neutral', withdrawn: 'neutral' }

/**
 * Admin › Applications (M-206, P10-Q14): every application from the server, newest first, with the status, the job's
 * country (M-138) and a search in candidate, job and company; server pages and the audited CSV export.
 */
export default function ApplicationsPage() {
  const { t } = useTranslation(['adminApplications', 'enums'])
  const format = useFormat()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const countries = useCountryOptions()
  const { params, setFilter, search, setSearch, clearFilters } = useUrlFilters()
  const filters = Object.fromEntries(['q', 'status', 'country'].map((name) => [name, params.get(name) ?? '']))
  const query = { page: Number(params.get('page')) || 1, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }
  const { data, isSuccess } = useGetAdminApplicationsQuery(query, { refetchOnMountOrArgChange: true })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const filtered = Object.values(filters).some(Boolean)

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      await downloadFromApi('/admin/applications/export', { ...query, page: undefined })
    } catch (error) {
      setExportError(errorText.code(error))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'candidate',
      header: t('columns.candidate'),
      render: (row) =>
        can(me, 'users.view') ? (
          <Link to={`/admin/candidates/${row.candidate.id}`} className={styles.strong}>
            {row.candidate.name}
          </Link>
        ) : (
          <span className={styles.strong}>{row.candidate.name}</span>
        ),
    },
    { key: 'role', header: t('columns.role'), render: (row) => <span className={styles.muted}>{row.job.title}</span> },
    { key: 'company', header: t('columns.company'), render: (row) => <span className={styles.muted}>{row.company}</span> },
    { key: 'country', header: t('columns.country'), render: (row) => <span className={styles.muted}>{row.job.country ? format.country(row.job.country) : '—'}</span> },
    { key: 'applied', header: t('columns.applied'), render: (row) => <span className={styles.muted}>{format.date(row.appliedAt)}</span> },
    { key: 'status', header: t('columns.status'), render: (row) => <PillBadge tone={TONES[row.status]}>{t(`enums:applicationStatus.${row.status}`)}</PillBadge> },
  ]

  return (
    <>
      <PageTitle
        title={t('title')}
        description={t('description')}
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
      <div className={styles.filters}>
        <TextField className={styles.search} type="search" name="q" aria-label={t('search')} placeholder={t('search')} value={search} onChange={(event) => setSearch(event.target.value)} />
        <SelectField
          name="status"
          className={styles.select}
          aria-label={t('filters.status')}
          value={filters.status}
          onChange={(event) => setFilter('status', event.target.value)}
          options={[{ value: '', label: t('filters.allStatuses') }, ...STATUSES.map((status) => ({ value: status, label: t(`enums:applicationStatus.${status}`) }))]}
        />
        <SelectField
          name="country"
          className={styles.select}
          aria-label={t('filters.country')}
          value={filters.country}
          onChange={(event) => setFilter('country', event.target.value)}
          options={[{ value: '', label: t('filters.allCountries') }, ...countries.map((country) => ({ value: country.code, label: country.name }))]}
        />
      </div>
      <div className={styles.results}>
        {data?.items.length > 0 ? (
          <>
            <DataTable className={styles.table} caption={t('caption')} columns={columns} rows={data.items} getRowKey={(row) => row.id} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => setFilter('page', String(next))} />
          </>
        ) : (
          isSuccess && (
            <EmptyState
              icon={FileText}
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
    </>
  )
}
