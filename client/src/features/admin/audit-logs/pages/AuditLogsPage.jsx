import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { Button, Icon, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { downloadCsv } from '@/utils/downloadCsv.js'
import AuditEventRow from '../components/AuditEventRow.jsx'
import { AUDIT_CATEGORIES } from '../data/auditEvents.js'
import { useAuditLog } from '../hooks/useAuditLog.js'
import { formatDateTime } from '../utils/formatDate.js'
import styles from './AuditLogsPage.module.css'

const PAGE_SIZE = 5

/**
 * Audit logs: a searchable, filterable, paginated list of events recorded on this device (plus sample events).
 * Rows expand to show details. "Export log" builds a CSV in the browser from the events currently matching.
 */
export default function AuditLogsPage() {
  const { events } = useAuditLog()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const [status, setStatus] = useState('')

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events.filter(
      (event) =>
        (category === 'all' || event.category === category) &&
        (!needle || [event.title, event.category, event.actor, event.detail].some((text) => text.toLowerCase().includes(needle))),
    )
  }, [events, query, category])

  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const first = (currentPage - 1) * PAGE_SIZE
  const visible = matching.slice(first, first + PAGE_SIZE)

  function changeFilter(update) {
    update()
    setPage(1)
    setOpenId(null)
  }

  function handleExport() {
    downloadCsv(
      [
        ['Event', 'Category', 'Recorded by', 'Time', 'Details'],
        ...matching.map((event) => [event.title, event.category, event.actor, formatDateTime(event.at), event.detail]),
      ],
      `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    setStatus(`Exported ${matching.length} ${matching.length === 1 ? 'event' : 'events'} as a CSV file saved to this device. Nothing was uploaded.`)
  }

  return (
    <>
      <PageTitle
        className={styles.title}
        title="Clear decisions. A clear record."
        description="Review administrative changes and oversight activity in your local workspace."
        actions={
          <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={handleExport} disabled={matching.length === 0}>
            Export log
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <TextField
          className={styles.search}
          aria-label="Search events"
          placeholder="Search events"
          type="search"
          value={query}
          onChange={(event) => changeFilter(() => setQuery(event.target.value))}
        />
        <FilterChips
          label="Filter by category"
          options={AUDIT_CATEGORIES}
          value={category}
          onChange={(next) => changeFilter(() => setCategory(next))}
        />
      </div>

      <div role="status">{status && <p className={styles.status}>{status}</p>}</div>

      <section className={styles.card} aria-label="Audit events">
        {visible.length > 0 ? (
          <ul className={styles.list}>
            {visible.map((event) => (
              <AuditEventRow
                key={event.id}
                event={event}
                open={openId === event.id}
                onToggle={() => setOpenId((current) => (current === event.id ? null : event.id))}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Search}
            title="No events match"
            description="Try a different search or choose another category to see more of the log."
          />
        )}

        <p className={styles.notice}>
          This is a local demo log, not an immutable security audit trail. Production requires server-side access control,
          timestamps, and tamper-resistant event storage.
        </p>

        {matching.length > PAGE_SIZE && (
          <nav className={styles.pager} aria-label="Audit log pages">
            <p className={styles.range}>
              Showing {first + 1}–{first + visible.length} of {matching.length} events
            </p>
            <div className={styles.pagerButtons}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Icon as={ChevronLeft} size={14} />}
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className={styles.pageNumber}>
                Page {currentPage} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                rightIcon={<Icon as={ChevronRight} size={14} />}
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        )}
      </section>
    </>
  )
}
