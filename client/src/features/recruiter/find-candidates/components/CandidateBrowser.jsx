import { HIRING_ROLES } from '@/app/roles.js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button, Skeleton, SkeletonRegion } from '@/components/ui'
import { tableState } from '@/components/common/tableState.js'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useShortlistToggle } from '../api.js'
import { useMatchJob } from '../hooks/useMatchJob.js'
import { EMPTY_FILTERS, filterParams } from '../utils/candidateText.js'
import CandidateCard, { CandidateCardSkeleton } from './CandidateCard.jsx'
import CompareModal from './CompareModal.jsx'
import DiscoveryToolbar from './DiscoveryToolbar.jsx'
import SortSelect from './SortSelect.jsx'
import styles from '../pages/FindCandidatesPage.module.css'

const MAX_COMPARED = 3
const SORTS = ['recommended', 'experience', 'name']
const DEBOUNCE_MS = 300
const RECRUITER = HIRING_ROLES
const SKELETON_CARDS = 6

/**
 * The search, filters, sort, cards and compare of Find candidates and Shortlists (A: recruiter A15, A24).
 * `useList(params)` is the page's RTK Query hook; `notice(data)` and `extra(candidate)` add page-specific lines;
 * `empty({ filtering, clear })` renders the empty state. Without Recruiter Plus (§3.22, P11c-Q10) the list holds the
 * company's applicants and search, the job, filters, sort, Shortlist and Compare are locked buttons.
 */
export default function CandidateBrowser({ useList, notice, extra, empty }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const locked = lacksEntitlement(me, 'discovery', RECRUITER)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('recommended')
  const [comparedIds, setComparedIds] = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [limitHit, setLimitHit] = useState(false)
  const { jobs, job, setJobId, ready, loading: jobsLoading } = useMatchJob()
  const [searchParams, setSearchParams] = useSearchParams()
  // "N relevant" on Jobs links here with `?relevant=1`: only that job's relevant candidates, until cleared.
  const relevantOnly = !locked && searchParams.get('relevant') === '1' && Boolean(job)
  const toggleShortlist = useShortlistToggle()
  const params = locked ? { query: '', filters: EMPTY_FILTERS, sort: 'recommended' } : { query: debounced, filters, sort, jobId: job?.id, relevant: relevantOnly }
  const list = useList(filterParams(params), { skip: !ready })
  const { data } = list
  const items = data?.items ?? []
  // `busy`: new search, filters or sort are loading; the current cards stay, dimmed. `loading`: nothing to show yet.
  const { loading: listLoading, busy } = tableState(list, items)
  const loading = jobsLoading || listLoading
  // On Free the server matches the cards to the newest live job.
  const matchJob = locked ? data?.matchJob : job
  // The "no more than 3" message stays until the selection changes.
  useEffect(() => setLimitHit(false), [comparedIds])
  const compared = comparedIds.map((id) => items.find((candidate) => candidate.id === id)).filter(Boolean)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  /** A fourth pick is refused with a message in the compare bar instead of a silently disabled checkbox. */
  function toggleCompare(id) {
    if (comparedIds.includes(id)) return setComparedIds(comparedIds.filter((value) => value !== id))
    if (comparedIds.length >= MAX_COMPARED) return setLimitHit(true)
    setComparedIds([...comparedIds, id])
  }

  /** Leaves the relevant-only view; the job stays chosen. */
  function showAll() {
    const next = new URLSearchParams(searchParams)
    next.delete('relevant')
    setSearchParams(next, { replace: true })
  }

  /** A job picked in the toolbar replaces the one linked from Jobs (`?jobId`) and the relevant-only view. */
  function changeJob(id) {
    setJobId(id)
    if (searchParams.has('jobId') || searchParams.has('relevant')) {
      const next = new URLSearchParams(searchParams)
      next.delete('jobId')
      next.delete('relevant')
      setSearchParams(next, { replace: true })
    }
  }

  function clear() {
    setQuery('')
    setFilters(EMPTY_FILTERS)
    if (relevantOnly) showAll()
  }

  return (
    <>
      <div className={styles.toolbar} data-tour="candidates-search">
        <DiscoveryToolbar locked={locked} jobsLoading={jobsLoading} query={query} onQueryChange={setQuery} jobs={jobs} job={job} onJobChange={changeJob} filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className={styles.resultsBar}>
        <p className={styles.count} aria-live="polite">
          <strong>{loading ? <Skeleton width={88} height={12} /> : t('discovery:find.count', { count: items.length })}</strong>
          {t('discovery:find.evidence')}
        </p>
        {locked ? (
          <PlanButton variant="outline" size="sm" entitlement="discovery" roles={RECRUITER}>
            {t('discovery:sort.recommended')}
          </PlanButton>
        ) : (
          <SortSelect options={SORTS.map((value) => ({ value, label: t(`discovery:sort.${value}`) }))} value={sort} onChange={setSort} label={t('discovery:sort.label')} />
        )}
      </div>
      {locked && <p className={styles.view}>{t('discovery:find.applicantsOnly')}</p>}
      {relevantOnly && (
        <p className={styles.relevantView} data-relevant-view>
          <span>{t('discovery:find.relevantView', { job: job.title })}</span>
          <button type="button" className={styles.showAll} onClick={showAll}>
            {t('discovery:find.showAll')}
          </button>
        </p>
      )}
      {data && notice?.(data)}

      {loading ? (
        <SkeletonRegion className={styles.grid}>
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <CandidateCardSkeleton key={index} />
          ))}
        </SkeletonRegion>
      ) : data && items.length === 0 ? (
        <div className={styles.grid}>
          <div className={styles.empty}>{empty({ filtering: Boolean(debounced.trim()) || Object.values(filters).some(Boolean), clear })}</div>
        </div>
      ) : (
        <div className={cx(styles.grid, busy && styles.busy)} aria-busy={busy || undefined}>
          {items.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              hasJob={Boolean(matchJob)}
              jobId={matchJob?.id}
              locked={locked}
              onToggleShortlist={() => toggleShortlist(candidate)}
              compared={comparedIds.includes(candidate.id)}
              onToggleCompare={() => toggleCompare(candidate.id)}
              extra={extra?.(candidate)}
            />
          ))}
        </div>
      )}

      {compared.length > 0 && (
        // Floats at the bottom of the screen while the cards scroll under it (owner 2026-11-17).
        <div className={styles.compareBar} data-compare-bar>
          <p aria-live="polite">
            <strong>{t('discovery:compare.selected', { count: compared.length })}</strong>
            {limitHit ? (
              <span className={styles.compareLimit} data-compare-limit>
                {t('discovery:compare.limit', { max: MAX_COMPARED })}
              </span>
            ) : compared.length < 2 ? (
              t('discovery:compare.needMore')
            ) : (
              t('discovery:compare.upTo', { max: MAX_COMPARED })
            )}
          </p>
          <div className={styles.compareActions}>
            <Button variant="ghost" size="sm" onClick={() => setComparedIds([])}>
              {t('discovery:compare.clear')}
            </Button>
            <Button size="sm" disabled={compared.length < 2} onClick={() => setCompareOpen(true)}>
              {t('discovery:compare.open')}
            </Button>
          </div>
        </div>
      )}

      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} candidates={compared} job={job} />
    </>
  )
}
