import { useMemo, useState } from 'react'
import { ChevronDown, MapPin, SearchX, Search, SlidersHorizontal } from 'lucide-react'
import { Button, Icon, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import aiGlyphDark from '@/assets/icons/ai-glyph-blue-dark.svg'
import AiJobSummaryModal from '../components/AiJobSummaryModal.jsx'
import AiSummaryButton from '../components/AiSummaryButton.jsx'
import JobCard from '../components/JobCard.jsx'
import JobFiltersModal from '../components/JobFiltersModal.jsx'
import { JOBS } from '../data/jobs.js'
import { EMPTY_FILTERS, SORT_OPTIONS, jobPath, searchJobs, sortJobs } from '../data/jobUtils.js'
import { useApplications } from '../hooks/useApplications.js'
import { useSavedJobs } from '../hooks/useSavedJobs.js'
import styles from './FindJobsPage.module.css'

const PAGE_SIZE = 9

/** Find jobs: live search, location, filters, sort and "show more" over the mock listings. */
export default function FindJobsPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('recommended')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const { isSaved, toggleSaved } = useSavedJobs()
  const { hasApplied, applyTo } = useApplications()

  const results = useMemo(() => sortJobs(searchJobs(JOBS, { query, location, filters }), sort), [query, location, filters, sort])
  const shown = results.slice(0, visible)
  const activeFilters = filters.workModes.length + filters.levels.length + filters.matches.length
  const topJob = results[0]

  function change(setter) {
    return (value) => {
      setter(value)
      setVisible(PAGE_SIZE)
    }
  }

  function reset() {
    setQuery('')
    setLocation('')
    setFilters(EMPTY_FILTERS)
    setVisible(PAGE_SIZE)
  }

  return (
    <div>
      <PageTitle
        className={styles.title}
        eyebrow="Your next chapter"
        title="Find work that fits you."
        description="Relevant opportunities. Meaningful connections. A better next move."
        actions={<AiSummaryButton onClick={() => setSummaryOpen(true)} disabled={!topJob} />}
      />

      <form className={styles.search} role="search" onSubmit={(event) => event.preventDefault()}>
        <div className={styles.fields}>
          <TextField
            className={styles.query}
            aria-label="Search jobs"
            placeholder="Job title, skills, or company"
            value={query}
            onChange={(event) => change(setQuery)(event.target.value)}
            leftIcon={<Icon as={Search} size={17} />}
            autoComplete="off"
          />
          <TextField
            className={styles.location}
            aria-label="Job location"
            placeholder="Location"
            value={location}
            onChange={(event) => change(setLocation)(event.target.value)}
            leftIcon={<Icon as={MapPin} size={16} />}
            autoComplete="off"
          />
          <Button
            variant="secondary"
            className={styles.filtersButton}
            onClick={() => setFiltersOpen(true)}
            leftIcon={<Icon as={SlidersHorizontal} size={15} />}
          >
            {activeFilters ? `Filters · ${activeFilters}` : 'Filters'}
          </Button>
        </div>
        <p className={styles.hint}>
          <img src={aiGlyphDark} alt="" width={12} height={12} />
          Try “remote product design” or “Figma fintech”. Search uses listed role evidence.
        </p>
      </form>

      <div className={styles.resultsBar}>
        <p className={styles.count} aria-live="polite">
          <strong>
            {results.length} {results.length === 1 ? 'opportunity' : 'opportunities'}
          </strong>{' '}
          worth your attention
        </p>
        <label className={styles.sort}>
          <span className="sr-only">Sort jobs</span>
          <select value={sort} onChange={(event) => change(setSort)(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon as={ChevronDown} size={11} />
        </label>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No jobs match your search"
          description="Try fewer words, a different location, or clear your filters to see every opportunity."
          action={
            <Button variant="secondary" onClick={reset}>
              Clear search and filters
            </Button>
          }
        />
      ) : (
        <>
          <ul className={styles.list}>
            {shown.map((job) => (
              <li key={job.id}>
                <JobCard job={job} detailsPath={jobPath(job.id)} saved={isSaved(job.id)} onToggleSave={toggleSaved} />
              </li>
            ))}
          </ul>
          {results.length > shown.length && (
            <div className={styles.more}>
              <p>
                Showing {shown.length} of {results.length}
              </p>
              <Button variant="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                Show more jobs
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
      />
      <AiJobSummaryModal
        job={topJob}
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        applied={topJob ? hasApplied(topJob.id) : false}
        onApply={applyTo}
      />
    </div>
  )
}
