import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, SearchX, Search, SlidersHorizontal } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { tableState } from '@/components/common/tableState.js'
import PageTitle from '@/components/common/PageTitle.jsx'
import aiGlyphDark from '@/assets/icons/ai-glyph-blue-dark.svg'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useSaveToggle, useSearchJobsQuery } from '../api.js'
import JobCard, { JobCardSkeleton } from '../components/JobCard.jsx'
import JobFiltersModal from '../components/JobFiltersModal.jsx'
import { countActiveFilters, EMPTY_FILTERS, searchParams } from '../utils/jobSearch.js'
import styles from './FindJobsPage.module.css'

const PAGE_SIZE = 9
const SORTS = ['recommended', 'newest', 'salary']
const DEBOUNCE_MS = 300

/**
 * Find jobs (M-137, OD2, §3.6): the header country's jobs, or the Remote view, from the server with keyword search,
 * filters and sort; the list shows nine at a time. The page-level AI summary is gone (M-059). `?q=` fills the search
 * (the "See all" link of a job alert digest).
 */
export default function FindJobsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const [urlParams] = useSearchParams()
  const initialQuery = urlParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('recommended')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const toggleSave = useSaveToggle()
  const search = useSearchJobsQuery(searchParams({ query: debounced, filters, sort }))
  const { data } = search
  const results = data?.items ?? []
  // A new search or filter dims the cards on screen; placeholders only when there is nothing to show yet.
  const { loading, busy } = tableState(search, results)
  const shown = results.slice(0, visible)
  const activeFilters = countActiveFilters(filters)
  const remote = data?.view.country === 'REMOTE'

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query)
      setVisible(PAGE_SIZE)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  function change(setter) {
    return (value) => {
      setter(value)
      setVisible(PAGE_SIZE)
    }
  }

  function reset() {
    setQuery('')
    setFilters(EMPTY_FILTERS)
    setVisible(PAGE_SIZE)
  }

  return (
    <div>
      <PageTitle className={styles.title} eyebrow={t('findJobs:page.eyebrow')} title={t('findJobs:page.title')} description={t('findJobs:page.description')} />

      <form className={styles.search} role="search" onSubmit={(event) => event.preventDefault()}>
        <div className={styles.fields}>
          <TextField
            className={styles.query}
            aria-label={t('findJobs:page.search')}
            placeholder={t('findJobs:page.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leftIcon={<Icon as={Search} size={17} />}
            autoComplete="off"
          />
          <Button variant="secondary" className={styles.filtersButton} onClick={() => setFiltersOpen(true)} leftIcon={<Icon as={SlidersHorizontal} size={15} />}>
            {activeFilters ? t('findJobs:page.filtersCount', { count: activeFilters }) : t('findJobs:page.filters')}
          </Button>
        </div>
        <p className={styles.hint}>
          <img src={aiGlyphDark} alt="" width={12} height={12} />
          {t('findJobs:page.hint')}
        </p>
        {data ? (
          <p className={styles.hint}>{remote ? t('findJobs:page.viewRemote') : t('findJobs:page.viewCountry', { country: format.country(data.view.country) })}</p>
        ) : (
          search.isLoading && (
            <p className={styles.hint}>
              <Skeleton width={180} />
            </p>
          )
        )}
      </form>

      <div className={styles.resultsBar}>
        {loading ? (
          <Skeleton width={150} height={12} />
        ) : (
          <p className={styles.count} aria-live="polite">
            <strong>{t('findJobs:page.count', { count: results.length })}</strong>
            {t('findJobs:page.worth')}
          </p>
        )}
        <label className={styles.sort}>
          <span className="sr-only">{t('findJobs:page.sort')}</span>
          <select value={sort} onChange={(event) => change(setSort)(event.target.value)}>
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`findJobs:page.sorts.${value}`)}
              </option>
            ))}
          </select>
          <Icon as={ChevronDown} size={11} />
        </label>
      </div>

      {loading ? (
        <SkeletonRegion className={styles.list}>
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </SkeletonRegion>
      ) : data && results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('findJobs:page.empty')}
          description={t('findJobs:page.emptyText')}
          action={
            <Button variant="secondary" onClick={reset}>
              {t('findJobs:page.clear')}
            </Button>
          }
        />
      ) : (
        <>
          <ul className={cx(styles.list, busy && styles.busy)} aria-busy={busy || undefined}>
            {shown.map((job) => (
              <li key={job.id}>
                <JobCard job={job} onToggleSave={toggleSave} />
              </li>
            ))}
          </ul>
          {results.length > shown.length && (
            <div className={styles.more}>
              <p>{t('findJobs:page.showing', { shown: shown.length, total: results.length })}</p>
              <Button variant="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                {t('findJobs:page.more')}
              </Button>
            </div>
          )}
        </>
      )}

      <JobFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={change(setFilters)}
        resultCount={results.length}
        remote={remote}
        currency={data?.view.currency}
      />
    </div>
  )
}
