import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Checkbox, Modal, SelectField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { useCountryOptions } from '@/lib/countries.js'
import { EMPTY_FILTERS } from '../utils/jobSearch.js'
import styles from './JobFiltersModal.module.css'

/**
 * Filters of Find jobs (OD2, U25, P4-Q4, OQ-6i, G-1): work model (country views list hybrid and on-site jobs only),
 * level, city, minimum yearly salary in the view's currency, and the eligible country inside the Remote view.
 * Filters apply live; the footer shows how many jobs match.
 */
export default function JobFiltersModal({ open, onClose, filters, onChange, resultCount, remote, currency }) {
  const { t } = useTranslation()
  const { data: config } = useGetConfigQuery()
  const countries = useCountryOptions().filter((option) => !option.isRemote)
  const groups = [
    ...(remote ? [] : [{ key: 'workPreference', options: (config?.enums.workPreference ?? []).filter((mode) => mode !== 'remote') }]),
    { key: 'level', options: config?.enums.jobLevel ?? [] },
  ]
  const enumOf = { workPreference: 'workPreference', level: 'jobLevel' }

  function toggle(key, option) {
    const current = filters[key]
    onChange({ ...filters, [key]: current.includes(option) ? current.filter((item) => item !== option) : [...current, option] })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('findJobs:filters.title')}
      description={t('findJobs:filters.description')}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={() => onChange(EMPTY_FILTERS)}>
            {t('findJobs:filters.clear')}
          </Button>
          <Button onClick={onClose}>{t('findJobs:filters.show', { count: resultCount })}</Button>
        </>
      }
    >
      <div className={styles.groups}>
        {groups.map((group) => (
          <fieldset key={group.key} className={styles.group}>
            <legend className={styles.legend}>{t(`findJobs:filters.${group.key}`)}</legend>
            <div className={styles.options}>
              {group.options.map((option) => (
                <Checkbox key={option} checked={filters[group.key].includes(option)} onChange={() => toggle(group.key, option)}>
                  {t(`enums:${enumOf[group.key]}.${option}`)}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        ))}
        {remote ? (
          <SelectField
            label={t('findJobs:filters.eligible')}
            name="eligible"
            options={[{ value: '', label: t('findJobs:filters.anyCountry') }, ...countries.map((option) => ({ value: option.code, label: option.name }))]}
            value={filters.eligible}
            onChange={(event) => onChange({ ...filters, eligible: event.target.value })}
          />
        ) : (
          <CityField label={t('findJobs:filters.city')} hint={t('findJobs:filters.cityHint')} name="jobsCity" value={filters.place} onChange={(place) => onChange({ ...filters, place })} />
        )}
        <TextField
          label={t('findJobs:filters.salary', { currency })}
          name="salaryMin"
          inputMode="numeric"
          hint={t('findJobs:filters.salaryHint')}
          value={filters.salaryMin}
          onChange={(event) => onChange({ ...filters, salaryMin: event.target.value.replace(/\D/g, '') })}
        />
      </div>
    </Modal>
  )
}
