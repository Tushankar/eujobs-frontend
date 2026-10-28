import { useId } from 'react'
import { cx } from '@/utils/cx.js'
import styles from './Field.module.css'

/**
 * Shared label + control + feedback wrapper (DS "Field"): persistent label,
 * nearby hint/error text, error names the problem. Used by every form control.
 */
export function Field({ id, label, hint, error, children, className }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      {typeof children === 'function' ? children({ describedBy, invalid: Boolean(error) }) : children}
      {error ? (
        <p className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Single-line input. `leftIcon` / `rightSlot` render inside the bordered control. */
export default function TextField({ label, hint, error, leftIcon, rightSlot, className, id, ...inputProps }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <div className={cx(styles.control, invalid && styles.invalid, inputProps.disabled && styles.disabled)}>
          {leftIcon && <span className={styles.leading}>{leftIcon}</span>}
          <input
            id={fieldId}
            className={styles.input}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...inputProps}
          />
          {rightSlot && <span className={styles.trailing}>{rightSlot}</span>}
        </div>
      )}
    </Field>
  )
}
