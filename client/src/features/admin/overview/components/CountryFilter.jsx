import { useTranslation } from 'react-i18next'
import { countryChoices, useCountryOptions } from '@/lib/countries.js'
import styles from './CountryFilter.module.css'
import CountryField from '@/components/common/CountryField.jsx'

/** M-138: "All countries / {country}" on the admin Overview, Analytics and Recruitment (Remote included, for jobs). */
export default function CountryFilter({ value, onChange }) {
  const { t } = useTranslation('adminOverview')
  const countries = useCountryOptions()
  return (
    <CountryField
      variant="filter"
      name="country"
      className={styles.filter}
      aria-label={t('country.label')}
      value={value}
      onChange={onChange}
      options={[{ value: '', label: t('country.all') }, ...countryChoices(countries)]}
    />
  )
}
