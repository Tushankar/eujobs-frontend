import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useGetConfigQuery, useGetLanguageCodesQuery } from '@/app/api.js'
import { Button, Checkbox, Icon, Panel, SelectField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { countActiveFilters, EMPTY_FILTERS } from '../utils/candidateText.js'
import styles from './DiscoveryToolbar.module.css'

const MIN_YEARS = [3, 5, 7, 9]

/**
 * Search box, "match to a job" select and the Filters panel (M-056, OD4, OQ-6f): work mode, availability,
 * experience, listed skill, language with a minimum level, right to work in the picker country, verified only and
 * an optional city (G-1). State lives in the page; this only renders it.
 */
export default function DiscoveryToolbar({ query, onQueryChange, jobs, job, onJobChange, filters, onFiltersChange }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { language, country } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const { data: codes = [] } = useGetLanguageCodesQuery()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilters = countActiveFilters(filters)
  const setFilter = (name) => (event) => onFiltersChange({ ...filters, [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
  const enumOptions = (name, anyLabel) => [{ value: '', label: anyLabel }, ...(config?.enums[name] ?? []).map((key) => ({ value: key, label: t(`enums:${name}.${key}`) }))]
  const languages = useMemo(
    () => codes.map((code) => ({ value: code, label: format.languageName(code) })).sort((a, b) => a.label.localeCompare(b.label, language)),
    [codes, format, language],
  )

  return (
    <Panel padding={16}>
      <div className={styles.row}>
        <TextField
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('discovery:toolbar.searchPlaceholder')}
          aria-label={t('discovery:toolbar.search')}
          leftIcon={<Icon as={Search} size={16} strokeWidth={2} />}
        />
        <SelectField
          className={styles.job}
          aria-label={t('discovery:toolbar.matchJob')}
          value={job?.id ?? ''}
          disabled={jobs.length === 0}
          onChange={(event) => onJobChange(event.target.value)}
          options={jobs.length > 0 ? jobs.map((item) => ({ value: item.id, label: item.title })) : [{ value: '', label: t('discovery:toolbar.noJobs') }]}
        />
        <Button
          variant="outline"
          className={styles.filtersButton}
          leftIcon={<Icon as={SlidersHorizontal} size={14} strokeWidth={2} />}
          aria-expanded={filtersOpen}
          aria-controls="candidate-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {t('discovery:toolbar.filters')}
          {activeFilters > 0 && <span className={styles.count}>{activeFilters}</span>}
        </Button>
      </div>

      {filtersOpen && (
        <div className={styles.filters} id="candidate-filters">
          <SelectField label={t('discovery:toolbar.workPreference')} name="workPreference" value={filters.workPreference} onChange={setFilter('workPreference')} options={enumOptions('workPreference', t('discovery:toolbar.anyWorkPreference'))} />
          <SelectField label={t('discovery:toolbar.availability')} name="availability" value={filters.availability} onChange={setFilter('availability')} options={enumOptions('availability', t('discovery:toolbar.anyAvailability'))} />
          <SelectField
            label={t('discovery:toolbar.experience')}
            name="minYears"
            value={filters.minYears}
            onChange={setFilter('minYears')}
            options={[{ value: '', label: t('discovery:toolbar.anyExperience') }, ...MIN_YEARS.map((years) => ({ value: String(years), label: t('discovery:toolbar.minYears', { count: years }) }))]}
          />
          <TextField label={t('discovery:toolbar.skill')} name="skill" placeholder={t('discovery:toolbar.skillPlaceholder')} value={filters.skill} onChange={setFilter('skill')} />
          <SelectField label={t('discovery:toolbar.language')} name="language" value={filters.language} onChange={setFilter('language')} options={[{ value: '', label: t('discovery:toolbar.anyLanguage') }, ...languages]} />
          <SelectField
            label={t('discovery:toolbar.languageLevel')}
            name="languageLevel"
            disabled={!filters.language}
            value={filters.languageLevel}
            onChange={setFilter('languageLevel')}
            options={enumOptions('languageLevel', t('discovery:toolbar.anyLevel'))}
          />
          <CityField label={t('discovery:toolbar.city')} hint={t('discovery:toolbar.cityHint')} name="candidateCity" value={filters.place} onChange={(place) => onFiltersChange({ ...filters, place })} />
          <div className={styles.checks}>
            {/* OD4: only a country view has a country to have the right to work in. */}
            {country && country !== 'REMOTE' && (
              <Checkbox name="rightToWork" checked={filters.rightToWork} onChange={setFilter('rightToWork')}>
                {t('discovery:toolbar.rightToWork', { country: format.country(country) })}
              </Checkbox>
            )}
            <Checkbox name="verified" checked={filters.verified} onChange={setFilter('verified')}>
              {t('discovery:toolbar.verified')}
            </Checkbox>
          </div>
          <Button variant="ghost" disabled={activeFilters === 0} onClick={() => onFiltersChange(EMPTY_FILTERS)}>
            {t('discovery:toolbar.clear')}
          </Button>
        </div>
      )}
    </Panel>
  )
}
