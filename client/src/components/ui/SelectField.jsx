import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import Icon from './Icon.jsx'
import { Field } from './TextField.jsx'
import styles from './Field.module.css'

/**
 * Native <select> in the DS field shell. `options` = [{ value, label }] or plain strings.
 * variant="filter": the pill dropdown of a list toolbar. It fills dark while a value other than the first
 * option is chosen and that first option is the "All …" default (value '' or 'all'), so applied filters stand out.
 *
 * Where the customisable select exists (Chrome/Edge, globals.css), the <button> is the field's face: every label sits
 * hidden in the same grid cell, so the field stays as wide as its longest option (like the native control), and
 * <selectedcontent> shows the chosen one with an ellipsis. Keyed by that label so a relabelled option (a count, a
 * new language) is copied in again. Other browsers ignore the button.
 */
export default function SelectField({ label, hint, error, options, placeholder, variant, className, id, ...selectProps }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const filter = variant === 'filter'
  const items = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
  const defaultValue = String(items[0]?.value ?? '')
  const current = String(selectProps.value ?? selectProps.defaultValue ?? '')
  const shownLabel = items.find((item) => String(item.value) === current)?.label ?? placeholder ?? ''
  const applied = filter && ['', 'all'].includes(defaultValue) && selectProps.value !== undefined && String(selectProps.value) !== defaultValue
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <div className={cx(styles.control, filter && styles.filter, applied && styles.applied, invalid && styles.invalid)}>
          <select
            id={fieldId}
            className={styles.input}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...selectProps}
          >
            <button type="button" key={shownLabel} className={styles.selectFace} tabIndex={-1}>
              <span className={styles.selectSizer} aria-hidden="true">
                {[placeholder, ...items.map((item) => item.label)].filter(Boolean).map((text, index) => (
                  <span key={index}>{text}</span>
                ))}
              </span>
              <selectedcontent />
            </button>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {items.map(({ value, label: optionLabel }) => (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            ))}
          </select>
          <span className={styles.trailing}>
            <Icon as={ChevronDown} size={14} />
          </span>
        </div>
      )}
    </Field>
  )
}
