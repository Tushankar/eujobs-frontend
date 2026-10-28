import { useState } from 'react'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { candidates } from '../data/candidates.js'
import { useMatchJob } from '../hooks/useMatchJob.js'
import { useShortlist } from '../hooks/useShortlist.js'
import { EMPTY_FILTERS, findCandidates, SORT_OPTIONS } from '../utils/discovery.js'
import CandidateCard from '../components/CandidateCard.jsx'
import CompareModal from '../components/CompareModal.jsx'
import DiscoveryToolbar from '../components/DiscoveryToolbar.jsx'
import SortSelect from '../components/SortSelect.jsx'
import styles from './FindCandidatesPage.module.css'

const MAX_COMPARED = 3

export default function FindCandidatesPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('recommended')
  const [comparedIds, setComparedIds] = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const { jobs, job, setJobId } = useMatchJob()
  const { isShortlisted, toggle } = useShortlist()

  const results = findCandidates(candidates, { query, filters, sort, job })
  const compared = comparedIds.map((id) => candidates.find((candidate) => candidate.id === id)).filter(Boolean)

  function toggleCompare(id) {
    setComparedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  function clearSearch() {
    setQuery('')
    setFilters(EMPTY_FILTERS)
  }

  return (
    <>
      <PageTitle
        eyebrow="Talent discovery"
        title="Meet talent that fits the role."
        description="Look beyond keywords. Understand the people behind the profiles."
      />

      <div className={styles.toolbar}>
        <DiscoveryToolbar
          query={query}
          onQueryChange={setQuery}
          jobs={jobs}
          job={job}
          onJobChange={setJobId}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      <div className={styles.resultsBar}>
        <p className={styles.count} aria-live="polite">
          <strong>
            {results.length} {results.length === 1 ? 'candidate' : 'candidates'}
          </strong>
          {' · Profile evidence, not hiring decisions'}
        </p>
        <SortSelect options={SORT_OPTIONS} value={sort} onChange={setSort} label="Sort candidates" />
      </div>

      {compared.length > 0 && (
        <div className={styles.compareBar}>
          <p>
            <strong>{compared.length} selected</strong>
            {compared.length < 2 ? ' · Select at least one more to compare' : ` · Up to ${MAX_COMPARED} candidates`}
          </p>
          <div className={styles.compareActions}>
            <Button variant="ghost" size="sm" onClick={() => setComparedIds([])}>
              Clear
            </Button>
            <Button size="sm" disabled={compared.length < 2} onClick={() => setCompareOpen(true)}>
              Compare candidates
            </Button>
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div className={styles.grid}>
          <div className={styles.empty}>
            <EmptyState
              icon={SearchX}
              title="No candidates match this search"
              description="Try a different name, role or skill, or clear the filters."
              action={
                <Button variant="outline" onClick={clearSearch}>
                  Clear search and filters
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {results.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              job={job}
              shortlisted={isShortlisted(candidate.id)}
              onToggleShortlist={() => toggle(candidate.id)}
              compared={comparedIds.includes(candidate.id)}
              compareDisabled={comparedIds.length >= MAX_COMPARED}
              onToggleCompare={() => toggleCompare(candidate.id)}
            />
          ))}
        </div>
      )}

      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} candidates={compared} job={job} />
    </>
  )
}
