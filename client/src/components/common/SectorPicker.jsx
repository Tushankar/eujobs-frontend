import { useId } from 'react'
import { Check } from 'lucide-react'
import { Field, Icon } from '@/components/ui'
import { useSectors } from '@/lib/sectors.js'
import { cx } from '@/utils/cx.js'
import styles from './SectorPicker.module.css'

/**
 * Several job sectors as toggle pills (2026-11-24: a job alert's sectors, a candidate's preferred sectors). At most
 * `max` can be on; the others are disabled until one is turned off. A sector hidden since it was picked stays listed.
 */
export default function SectorPicker({ label, hint, error, value, onChange, max, name }) {
  const id = useId()
  const sectors = useSectors()
  const full = value.length >= max
  const options = sectors.options().concat(value.filter((key) => !sectors.options().some((option) => option.value === key)).map((key) => ({ value: key, label: sectors.name(key) ?? key })))
  const toggle = (key) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key])

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {({ describedBy }) => (
        <div id={id} className={styles.pills} role="group" aria-describedby={describedBy} data-sector-picker={name}>
          {options.map((option) => {
            const on = value.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                className={cx(styles.pill, on && styles.on)}
                onClick={() => toggle(option.value)}
                data-sector-option={option.value}
              >
                {on && <Icon as={Check} size={13} />}
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </Field>
  )
}
