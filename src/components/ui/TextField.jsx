import { useId, useState } from 'react'
import { cx } from '@/utils/cx.js'
import styles from './Field.module.css'

/**
 * Shared label + control + feedback wrapper (DS "Field"): persistent label,
 * nearby hint/error text, error names the problem. Used by every form control.
 *
 * Feedback eases open and closed instead of mounting and unmounting, so typing (which clears an
 * error) never snaps the content below the field up or down.
 */
export function Field({ id, label, hint, error, children, className }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const message = error ? { text: error, isError: true } : hint ? { text: hint, isError: false } : null
  // Keep the last message while the region collapses so its text doesn't vanish mid-animation.
  const [held, setHeld] = useState(message)
  // A field that starts with a hint shows it immediately; only feedback that appears later animates in.
  const [startsOpen] = useState(Boolean(message))
  if (message && (held?.text !== message.text || held.isError !== message.isError)) setHeld(message)

  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      {typeof children === 'function' ? children({ describedBy, invalid: Boolean(error) }) : children}
      {held && (
        <div className={cx(styles.feedback, startsOpen && styles.instant)} data-open={Boolean(message)} aria-hidden={!message}>
          <div className={styles.feedbackInner}>
            <p
              className={held.isError ? styles.error : styles.hint}
              id={`${id}-${held.isError ? 'error' : 'hint'}`}
              role={held.isError ? 'alert' : undefined}
            >
              {held.text}
            </p>
          </div>
        </div>
      )}
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
