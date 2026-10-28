import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import Icon from './Icon.jsx'
import { Field } from './TextField.jsx'
import styles from './Field.module.css'

/** Native <select> in the DS field shell. `options` = [{ value, label }] or plain strings. */
export default function SelectField({ label, hint, error, options, placeholder, className, id, ...selectProps }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <div className={cx(styles.control, invalid && styles.invalid)}>
          <select
            id={fieldId}
            className={styles.input}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...selectProps}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => {
              const { value, label: optionLabel } = typeof option === 'string' ? { value: option, label: option } : option
              return (
                <option key={value} value={value}>
                  {optionLabel}
                </option>
              )
            })}
          </select>
          <span className={styles.trailing}>
            <Icon as={ChevronDown} size={14} />
          </span>
        </div>
      )}
    </Field>
  )
}
