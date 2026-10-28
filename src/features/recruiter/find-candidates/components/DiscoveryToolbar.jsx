import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Button, Icon, Panel, SelectField, TextField } from '@/components/ui'
import { candidates } from '../data/candidates.js'
import { countActiveFilters, EMPTY_FILTERS } from '../utils/discovery.js'
import styles from './DiscoveryToolbar.module.css'

const WORK_MODES = ['Remote', 'Hybrid', 'On-site']
const AVAILABILITIES = [...new Set(candidates.map((candidate) => candidate.availability))]
const SKILLS = [...new Set(candidates.flatMap((candidate) => candidate.skills))].sort()
const MIN_YEARS = [3, 5, 7, 9]

const anyOption = (label) => ({ value: '', label })

/** Search box, "match to a job" select and the Filters panel. State lives in the page; this only renders it. */
export default function DiscoveryToolbar({ query, onQueryChange, jobs, job, onJobChange, filters, onFiltersChange }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilters = countActiveFilters(filters)
  const setFilter = (name) => (event) => onFiltersChange({ ...filters, [name]: event.target.value })

  return (
    <Panel padding={16}>
      <div className={styles.row}>
        <TextField
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Name, role, skill, or ‘senior Figma remote’"
          aria-label="Search candidates"
          leftIcon={<Icon as={Search} size={16} strokeWidth={2} />}
        />
        <SelectField
          className={styles.job}
          aria-label="Match candidates to a job"
          value={job?.id ?? ''}
          disabled={jobs.length === 0}
          onChange={(event) => onJobChange(event.target.value)}
          options={jobs.length > 0 ? jobs.map((item) => ({ value: item.id, label: item.title })) : [anyOption('No open jobs')]}
        />
        <Button
          variant="outline"
          className={styles.filtersButton}
          leftIcon={<Icon as={SlidersHorizontal} size={14} strokeWidth={2} />}
          aria-expanded={filtersOpen}
          aria-controls="candidate-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
          {activeFilters > 0 && <span className={styles.count}>{activeFilters}</span>}
        </Button>
      </div>

      {filtersOpen && (
        <div className={styles.filters} id="candidate-filters">
          <SelectField
            label="Work mode"
            value={filters.workMode}
            onChange={setFilter('workMode')}
            options={[anyOption('Any work mode'), ...WORK_MODES]}
          />
          <SelectField
            label="Availability"
            value={filters.availability}
            onChange={setFilter('availability')}
            options={[anyOption('Any availability'), ...AVAILABILITIES]}
          />
          <SelectField
            label="Experience"
            value={filters.minYears}
            onChange={setFilter('minYears')}
            options={[anyOption('Any experience'), ...MIN_YEARS.map((years) => ({ value: String(years), label: `${years}+ years` }))]}
          />
          <SelectField
            label="Listed skill"
            value={filters.skill}
            onChange={setFilter('skill')}
            options={[anyOption('Any skill'), ...SKILLS]}
          />
          <Button variant="ghost" disabled={activeFilters === 0} onClick={() => onFiltersChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </div>
      )}
    </Panel>
  )
}
