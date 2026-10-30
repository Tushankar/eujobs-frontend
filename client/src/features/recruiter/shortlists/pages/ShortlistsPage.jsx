import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, SearchX } from 'lucide-react'
import { Button } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import CandidateCard from '@/features/recruiter/find-candidates/components/CandidateCard.jsx'
import CompareModal from '@/features/recruiter/find-candidates/components/CompareModal.jsx'
import DiscoveryToolbar from '@/features/recruiter/find-candidates/components/DiscoveryToolbar.jsx'
import SortSelect from '@/features/recruiter/find-candidates/components/SortSelect.jsx'
import { candidates } from '@/features/recruiter/find-candidates/data/candidates.js'
import { useMatchJob } from '@/features/recruiter/find-candidates/hooks/useMatchJob.js'
import { useShortlist } from '@/features/recruiter/find-candidates/hooks/useShortlist.js'
import { EMPTY_FILTERS, findCandidates, SORT_OPTIONS } from '@/features/recruiter/find-candidates/utils/discovery.js'
import { useLiveApplicant } from '@/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js'
import styles from './ShortlistsPage.module.css'

const MAX_COMPARED = 3

/**
 * Shortlists: the Find candidates search, filter, sort and compare experience over the candidates shortlisted
 * on this device (the same state as the bookmark on Find candidates and the profile).
 */
export default function ShortlistsPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('recommended')
  const [comparedIds, setComparedIds] = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const { jobs, job, setJobId } = useMatchJob()
  const { shortlistedIds, isShortlisted, toggle } = useShortlist()

  const liveApplicant = useLiveApplicant()

  const shortlisted = [...candidates, ...(liveApplicant ? [liveApplicant] : [])].filter((candidate) => shortlistedIds.includes(candidate.id))
  const results = findCandidates(shortlisted, { query, filters, sort, job })
  const compared = comparedIds.map((id) => shortlisted.find((candidate) => candidate.id === id)).filter(Boolean)

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
        title="A shortlist with real potential."
        description="Your considered selection. Compare the evidence, then take the next step."
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
            {shortlisted.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="No one on your shortlist yet"
                description="Bookmark candidates in Find candidates and they will be collected here to compare."
                action={
                  <Button as={Link} to="/recruiter/find-candidates">
                    Find candidates
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No shortlisted candidates match this search"
                description="Try a different name, role or skill, or clear the filters."
                action={
                  <Button variant="outline" onClick={clearSearch}>
                    Clear search and filters
                  </Button>
                }
              />
            )}
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
