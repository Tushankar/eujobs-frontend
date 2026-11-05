import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/ui'
import { useCountryOptions } from '@/lib/countries.js'
import styles from './CountryFilter.module.css'

/** M-138: "All countries / {country}" on the admin Overview, Analytics and Recruitment (Remote included, for jobs). */
export default function CountryFilter({ value, onChange }) {
  const { t } = useTranslation('adminOverview')
  const countries = useCountryOptions()
  return (
    <SelectField variant="filter"
      name="country"
      className={styles.filter}
      aria-label={t('country.label')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={[{ value: '', label: t('country.all') }, ...countries.map((country) => ({ value: country.code, label: country.name }))]}
    />
  )
}
