import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, SearchX } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import GetStartedCard from '@/components/common/GetStartedCard.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon, TextField } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetRecruiterJobsQuery } from '../api.js'
import JobsTable from '../components/JobsTable.jsx'
import { useMarkSeen } from '@/features/notifications/api.js'
import styles from './JobsPage.module.css'

/** The recruiter's jobs (M-040): tabs and status sort in the catalogue order published, paused, draft, closed. */
export default function JobsPage() {
  // P11c-Q18: a recruiter's plan_ended notification opens this page; opening it marks that notification read.
  useMarkSeen('page', 'jobs')
  const { t } = useTranslation()
  const { language } = usePreferences()
  const jobText = useJobText()
  const { data: config } = useGetConfigQuery()
  const { data, isLoading } = useGetRecruiterJobsQuery()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(null)
  const jobs = data?.items ?? []
  const statusOrder = config?.enums.jobStatus ?? []

  const needle = query.trim().toLocaleLowerCase(language)
  const matches = (job) =>
    !needle ||
    [job.title, jobText.place(job), job.workPreference && t(`enums:workPreference.${job.workPreference}`), job.employmentType && t(`enums:employmentType.${job.employmentType}`)]
      .filter(Boolean)
      .some((text) => text.toLocaleLowerCase(language).includes(needle))
  const visible = jobs.filter((job) => (tab === 'all' || job.status === tab) && matches(job))
  if (sort) {
    const direction = sort.direction === 'asc' ? 1 : -1
    const compare = {
      title: (a, b) => a.title.localeCompare(b.title, language),
      relevantCount: (a, b) => a.relevantCount - b.relevantCount,
      status: (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status),
    }[sort.key]
    visible.sort((a, b) => direction * compare(a, b))
  }
  // A recruiter with no jobs at all gets the get-started card instead of filters that have nothing to filter.
  const noJobs = Boolean(data) && jobs.length === 0
  const countOf = (status) => (data ? jobs.filter((job) => status === 'all' || job.status === status).length : undefined)

  function toggleSort(key) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  }

  function clearFilters() {
    setTab('all')
    setQuery('')
  }

  const createButton = (
    <Button as={Link} to="/recruiter/jobs/new" leftIcon={<Icon as={Plus} size={14} />}>
      {t('jobs:page.create')}
    </Button>
  )

  return (
    <>
      <PageTitle title={t('jobs:page.title')} description={t('jobs:page.description')} actions={!noJobs && <div className={styles.actions}>{createButton}</div>} />

      {noJobs ? (
        <GetStartedCard
          id="jobs-start-title"
          className={styles.start}
          title={t('jobs:page.start.title')}
          text={t('jobs:page.start.text')}
          steps={t('jobs:page.start.steps', { returnObjects: true })}
          action={createButton}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <FilterChips
              className={styles.tabs}
              label={t('jobs:page.filterLabel')}
              options={['all', ...statusOrder].map((status) => ({
                id: status,
                label: status === 'all' ? t('jobs:page.all') : t(`enums:jobStatus.${status}`),
                count: countOf(status),
              }))}
              value={tab}
              onChange={setTab}
            />
            <TextField variant="filter"
              className={styles.search}
              aria-label={t('jobs:page.search')}
              type="search"
              placeholder={t('jobs:page.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className={styles.table}>
            {isLoading || visible.length > 0 ? (
              <JobsTable jobs={visible} sort={sort} onSort={toggleSort} caption={t('jobs:page.caption')} loading={isLoading} />
            ) : (
              data && (
                <EmptyState
                  icon={SearchX}
                  title={t('jobs:page.emptyFiltered')}
                  description={t('jobs:page.emptyFilteredText')}
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      {t('jobs:page.clearFilters')}
                    </Button>
                  }
                />
              )
            )}
          </div>
        </>
      )}
    </>
  )
}
