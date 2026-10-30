import { useId } from 'react'
import { cx } from '@/utils/cx.js'
import { Field } from './TextField.jsx'
import styles from './Field.module.css'

export default function TextareaField({ label, hint, error, className, id, ...textareaProps }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <div className={cx(styles.control, invalid && styles.invalid)}>
          <textarea
            id={fieldId}
            className={styles.input}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...textareaProps}
          />
        </div>
      )}
    </Field>
  )
}
