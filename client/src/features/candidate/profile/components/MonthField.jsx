import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Icon } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import fieldStyles from '@/components/ui/Field.module.css'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './MonthField.module.css'

const PAST_YEARS = 70

/**
 * A month as two dropdowns, Month + Year (LinkedIn-style), for a "YYYY-MM" value. `onChange` gets "YYYY-MM"
 * once both are picked and '' while one is missing. `futureYears` adds years after this one (expiry dates);
 * `optional` lets the placeholder be picked again to clear the month.
 * The selects are named `${name}Month` and `${name}Year`.
 */
export default function MonthField({ label, name, value, onChange, error, disabled = false, optional = false, futureYears = 0 }) {
  const { t } = useTranslation()
  const { language } = usePreferences()
  const id = useId()
  const [draft, setDraft] = useState({ month: value ? value.slice(5, 7) : '', year: value ? value.slice(0, 4) : '' })
  const shown = disabled ? { month: '', year: '' } : value ? { month: value.slice(5, 7), year: value.slice(0, 4) } : draft

  const months = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' })
    return Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1).padStart(2, '0'), label: format.format(Date.UTC(2000, index, 1)) }))
  }, [language])
  const [thisYear] = useState(() => new Date().getFullYear())
  const years = Array.from({ length: PAST_YEARS + futureYears + 1 }, (_, index) => String(thisYear + futureYears - index))

  function update(part) {
    const next = { ...shown, ...part }
    setDraft(next)
    onChange(next.month && next.year ? `${next.year}-${next.month}` : '')
  }

  const select = (part, options, placeholder, { describedBy, invalid }) => (
    <div className={cx(fieldStyles.control, invalid && fieldStyles.invalid, disabled && styles.disabled)}>
      <select
        id={`${id}-${part}`}
        name={`${name}${part === 'month' ? 'Month' : 'Year'}`}
        className={fieldStyles.input}
        aria-label={`${label} · ${placeholder}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        value={shown[part]}
        onChange={(event) => update({ [part]: event.target.value })}
      >
        <option value="" disabled={!optional}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className={fieldStyles.trailing}>
        <Icon as={ChevronDown} size={14} />
      </span>
    </div>
  )

  return (
    <Field id={`${id}-month`} label={label} error={error}>
      {(state) => (
        <div className={styles.pair}>
          {select('month', months, t('profile:form.month'), state)}
          {select(
            'year',
            years.map((year) => ({ value: year, label: year })),
            t('profile:form.year'),
            state,
          )}
        </div>
      )}
    </Field>
  )
}
