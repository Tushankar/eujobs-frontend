import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Search } from 'lucide-react'
import { can } from '@/app/permissions.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { tableState } from '@/components/common/tableState.js'
import Pagination from '@/components/common/Pagination.jsx'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { useUrlFilters } from '@/lib/useUrlFilters.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetAuditEventsQuery } from '../api.js'
import AuditEventRow, { AuditEventsSkeleton } from '../components/AuditEventRow.jsx'
import styles from './AuditLogsPage.module.css'

const CATEGORIES = ['workspace', 'policy', 'moderation', 'reports', 'access', 'learning', 'payments', 'jobs']
const ACTOR_TYPES = ['admin', 'user', 'system']

/**
 * Admin › Audit logs (M-162, M-163, M-206): admin, user and system events from the server, newest first, with the
 * category chips (Learning, Payments and Jobs included), the actor type, a search and server pagination. Rows expand
 * to their details. The CSV export is built and audited by the server (needs `reports.export`).
 */
export default function AuditLogsPage() {
  const { t } = useTranslation(['audit', 'enums'])
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { params, setFilter, search, setSearch } = useUrlFilters()
  const [openId, setOpenId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const filters = { q: params.get('q') ?? '', category: params.get('category') ?? '', actorType: params.get('actorType') ?? '' }
  const query = { page: Number(params.get('page')) || 1, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }
  const result = useGetAuditEventsQuery(query, { refetchOnMountOrArgChange: true })
  const { data, isSuccess } = result
  const list = tableState(result, data?.items ?? [])

  function changeFilter(name, value) {
    setFilter(name, value)
    setOpenId(null)
  }

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      await downloadFromApi('/admin/audit-events/export', { ...query, page: undefined })
    } catch (error) {
      setExportError(errorText.code(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageTitle
        className={styles.title}
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

      <div className={styles.toolbar}>
        <TextField variant="filter"
          className={styles.search}
          name="q"
          aria-label={t('search')}
          placeholder={t('search')}
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setOpenId(null)
          }}
        />
        <SelectField variant="filter"
          className={styles.actor}
          name="actorType"
          aria-label={t('actorType')}
          value={filters.actorType}
          onChange={(event) => changeFilter('actorType', event.target.value)}
          options={[{ value: '', label: t('allActors') }, ...ACTOR_TYPES.map((type) => ({ value: type, label: t(`enums:actorType.${type}`) }))]}
        />
        <FilterChips
          className={styles.categories}
          label={t('categories')}
          options={[{ id: 'all', label: t('allCategories') }, ...CATEGORIES.map((id) => ({ id, label: t(`enums:auditCategory.${id}`) }))]}
          value={filters.category || 'all'}
          onChange={(next) => changeFilter('category', next === 'all' ? '' : next)}
        />
      </div>

      <section className={styles.card} aria-label={t('listLabel')}>
        {list.loading ? (
          <AuditEventsSkeleton />
        ) : data?.items.length > 0 ? (
          <ul className={cx(styles.list, list.busy && styles.busy)} aria-busy={list.busy || undefined}>
            {data.items.map((event) => (
              <AuditEventRow key={event.id} event={event} open={openId === event.id} onToggle={() => setOpenId((current) => (current === event.id ? null : event.id))} />
            ))}
          </ul>
        ) : (
          isSuccess && <EmptyState icon={Search} title={t('empty')} description={t('emptyText')} />
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => changeFilter('page', String(next))} />}
      </section>
    </>
  )
}
