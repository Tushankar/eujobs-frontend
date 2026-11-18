import { useId, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import fieldStyles from './Field.module.css'
import styles from './CodeInput.module.css'

/**
 * A one-time code as separate digit boxes (owner 2026-11-18, LinkedIn-style). Typing moves to the next box, Backspace
 * to the previous one, arrows move; a paste or the phone's code suggestion fills every box. `value` is the digits typed
 * so far; `onChange` gets the new string.
 */
export default function CodeInput({ label, hideLabel = false, value, onChange, length = 6, error, autoFocus, disabled, className }) {
  const { t } = useTranslation()
  const id = useId()
  const boxes = useRef([])
  // The newest code: the focus moves to the next box before the parent's new `value` renders, so the handlers read
  // this instead of the prop (else the "no gaps" rule sees the old, shorter code and sends the focus back).
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  }, [value])
  const focus = (index) => boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus()

  function change(next) {
    latest.current = next
    onChange(next)
  }

  /** Writes `digits` from box `index` on and focuses the box after them. */
  function put(index, digits) {
    const chars = latest.current.padEnd(length, ' ').split('')
    digits.split('').forEach((digit, offset) => {
      if (index + offset < length) chars[index + offset] = digit
    })
    change(chars.join('').replace(/\s+$/, '').replace(/\s/g, ''))
    focus(index + digits.length)
  }

  function handleKeyDown(event, index) {
    const current = latest.current
    if (event.key === 'Backspace' && !current[index]) {
      event.preventDefault()
      change(current.slice(0, Math.max(0, index - 1)) + current.slice(index))
      focus(index - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focus(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focus(index + 1)
    }
  }

  return (
    <div className={cx(fieldStyles.field, className)} role="group" aria-labelledby={`${id}-label`} data-code-input>
      <span id={`${id}-label`} className={hideLabel ? 'sr-only' : fieldStyles.label}>
        {label}
      </span>
      <div className={styles.boxes}>
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element
            }}
            className={cx(styles.box, value[index] && styles.filled, error && styles.invalid)}
            name={index === 0 ? 'code' : undefined}
            value={value[index] ?? ''}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            // Room for a whole code, so a paste or autofill into any box arrives in onChange.
            maxLength={length}
            aria-label={t('common:codeDigit', { index: index + 1, count: length })}
            aria-invalid={Boolean(error)}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            // The code has no gaps: a box after the first empty one sends the focus back to it.
            onFocus={(event) => (index > latest.current.length ? focus(latest.current.length) : event.target.select())}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPaste={(event) => {
              event.preventDefault()
              const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
              if (digits) put(digits.length === length ? 0 : index, digits)
            }}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '')
              const current = latest.current
              if (!digits) change(current.slice(0, index) + current.slice(index + 1))
              // Typing after this box's digit replaces it; several digits at once (the phone's autofill) fill from here on.
              else put(index, digits.length === 2 && digits[0] === current[index] ? digits[1] : digits)
            }}
          />
        ))}
      </div>
      {error && (
        <p className={fieldStyles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
