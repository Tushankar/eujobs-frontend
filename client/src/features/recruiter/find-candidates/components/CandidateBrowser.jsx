import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
const RECRUITER = ['recruiter']
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
  const { jobs, job, setJobId, ready, loading: jobsLoading } = useMatchJob()
  const toggleShortlist = useShortlistToggle()
  const params = locked ? { query: '', filters: EMPTY_FILTERS, sort: 'recommended' } : { query: debounced, filters, sort, jobId: job?.id }
  const list = useList(filterParams(params), { skip: !ready })
  const { data } = list
  const items = data?.items ?? []
  // `busy`: new search, filters or sort are loading; the current cards stay, dimmed. `loading`: nothing to show yet.
  const { loading: listLoading, busy } = tableState(list, items)
  const loading = jobsLoading || listLoading
  // On Free the server matches the cards to the newest live job.
  const matchJob = locked ? data?.matchJob : job
  const compared = comparedIds.map((id) => items.find((candidate) => candidate.id === id)).filter(Boolean)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  function toggleCompare(id) {
    setComparedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  function clear() {
    setQuery('')
    setFilters(EMPTY_FILTERS)
  }

  return (
    <>
      <div className={styles.toolbar} data-tour="candidates-search">
        <DiscoveryToolbar locked={locked} jobsLoading={jobsLoading} query={query} onQueryChange={setQuery} jobs={jobs} job={job} onJobChange={setJobId} filters={filters} onFiltersChange={setFilters} />
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
      {data && notice?.(data)}

      {compared.length > 0 && (
        <div className={styles.compareBar}>
          <p>
            <strong>{t('discovery:compare.selected', { count: compared.length })}</strong>
            {compared.length < 2 ? t('discovery:compare.needMore') : t('discovery:compare.upTo', { max: MAX_COMPARED })}
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
              compareDisabled={comparedIds.length >= MAX_COMPARED}
              onToggleCompare={() => toggleCompare(candidate.id)}
              extra={extra?.(candidate)}
            />
          ))}
        </div>
      )}

      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} candidates={compared} job={job} />
    </>
  )
}
