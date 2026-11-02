import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useGetConfigQuery, useGetLanguageCodesQuery } from '@/app/api.js'
import { Button, Icon, IconButton, SelectField } from '@/components/ui'
import { useCountryOptions } from '@/lib/countries.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import styles from './JobStepFields.module.css'

/** M-035, P4-D6: required languages, each with a minimum level; unique codes, at most `max`. */
export function LanguageRequirements({ value, onChange, max, error }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { language } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const { data: codes = [] } = useGetLanguageCodesQuery()
  const options = useMemo(
    () => codes.map((code) => ({ value: code, label: format.languageName(code) })).sort((a, b) => a.label.localeCompare(b.label, language)),
    [codes, format, language],
  )
  const levels = (config?.enums.languageLevel ?? []).map((level) => ({ value: level, label: t(`enums:languageLevel.${level}`) }))
  const update = (index, change) => onChange(value.map((row, i) => (i === index ? { ...row, ...change } : row)))

  return (
    <fieldset className={styles.listField}>
      <legend className={styles.listLegend}>{t('jobs:fields.languages')}</legend>
      <p className={styles.note}>{t('jobs:fields.languagesHint')}</p>
      {value.map((row, index) => (
        <div key={index} className={styles.listRow}>
          <SelectField
            label={t('jobs:fields.language')}
            name={`language-${index}`}
            options={options.filter((option) => option.value === row.code || !value.some((other) => other.code === option.value))}
            value={row.code}
            onChange={(event) => update(index, { code: event.target.value })}
          />
          <SelectField label={t('jobs:fields.minLevel')} name={`minLevel-${index}`} options={levels} value={row.minLevel} onChange={(event) => update(index, { minLevel: event.target.value })} />
          <IconButton icon={X} className={styles.listRemove} label={t('jobs:fields.removeLanguage', { language: format.languageName(row.code) })} onClick={() => onChange(value.filter((_, i) => i !== index))} />
        </div>
      ))}
      {error && (
        <p className={styles.listError} role="alert">
          {error}
        </p>
      )}
      {value.length < max && options.length > value.length && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon as={Plus} size={14} />}
            onClick={() => onChange([...value, { code: options.find((option) => !value.some((row) => row.code === option.value)).value, minLevel: 'b2' }])}
          >
            {t('jobs:fields.addLanguage')}
          </Button>
        </div>
      )}
    </fieldset>
  )
}

/** OQ-6i: the eligible countries of a remote job (EU 27 + UK); empty means all of them. */
export function EligibleCountries({ value, onChange, error }) {
  const { t } = useTranslation()
  const format = useFormat()
  const options = useCountryOptions().filter((option) => !option.isRemote && !value.includes(option.code))

  return (
    <div className={styles.listField}>
      <SelectField
        label={t('jobs:fields.remoteCountries')}
        name="remoteCountry"
        hint={t('jobs:fields.remoteCountriesHint')}
        placeholder={t('jobs:fields.addCountry')}
        options={options.map((option) => ({ value: option.code, label: option.name }))}
        value=""
        onChange={(event) => event.target.value && onChange([...value, event.target.value])}
        error={error}
      />
      {value.length > 0 && (
        <ul className={styles.countryChips}>
          {value.map((code) => (
            <li key={code} className={styles.countryChip}>
              {format.country(code)}
              <button type="button" aria-label={t('jobs:fields.removeCountry', { country: format.country(code) })} onClick={() => onChange(value.filter((item) => item !== code))}>
                <Icon as={X} size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
