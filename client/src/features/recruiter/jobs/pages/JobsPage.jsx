import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Plus } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon, TextField } from '@/components/ui'
import AiJobSummary from '../components/AiJobSummary.jsx'
import JobsTable from '../components/JobsTable.jsx'
import { useJobs } from '../hooks/useJobs.js'
import styles from './JobsPage.module.css'

const TABS = [
  { id: 'all', label: 'All jobs' },
  { id: 'published', label: 'Published' },
  { id: 'paused', label: 'Paused' },
  { id: 'draft', label: 'Draft' },
]

function matchesQuery(job, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [job.title, job.location, job.workPreference, job.employmentType].some((field) =>
    field.toLowerCase().includes(needle),
  )
}

function compareBy(key) {
  if (key === 'relevant') return (a, b) => a.relevant - b.relevant
  return (a, b) => String(a[key]).localeCompare(String(b[key]))
}

export default function JobsPage() {
  const { jobs, setStatus } = useJobs()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(null)

  const visible = jobs.filter((job) => (tab === 'all' || job.status === tab) && matchesQuery(job, query))
  if (sort) {
    const direction = sort.direction === 'asc' ? 1 : -1
    visible.sort((a, b) => direction * compareBy(sort.key)(a, b))
  }
  const filtering = tab !== 'all' || query.trim() !== ''

  function toggleSort(key) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  }

  function clearFilters() {
    setTab('all')
    setQuery('')
  }

  return (
    <>
      <PageTitle
        title="The right brief. The right people."
        description="Create, manage, and refine the roles that will shape your team."
        actions={
          <div className={styles.actions}>
            <AiJobSummary jobs={jobs.filter((job) => job.status !== 'draft')} />
            <Button as={Link} to="/recruiter/jobs/new" leftIcon={<Icon as={Plus} size={14} />}>
              Create a job
            </Button>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <FilterChips
          className={styles.chips}
          label="Filter jobs by status"
          options={TABS}
          value={tab}
          onChange={setTab}
        />
        <TextField
          className={styles.search}
          aria-label="Search your roles"
          type="search"
          placeholder="Search your roles"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className={styles.table}>
        {visible.length > 0 ? (
          <JobsTable jobs={visible} onStatusChange={setStatus} sort={sort} onSort={toggleSort} caption="Your roles" />
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title={filtering ? 'No roles match your filters' : 'No jobs yet'}
            description={filtering ? 'Try another status or a different search.' : 'You have not created a job yet.'}
            action={
              filtering ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button as={Link} to="/recruiter/jobs/new" leftIcon={<Icon as={Plus} size={14} />}>
                  Create a job
                </Button>
              )
            }
          />
        )}
      </div>
    </>
  )
}
