import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { addDays, fromKey, monthStart, shiftMonth, todayKey, weekdayIndex } from '@/utils/calendarDays.js'
import { cx } from '@/utils/cx.js'
import Icon from './Icon.jsx'
import { Field } from './TextField.jsx'
import fieldStyles from './Field.module.css'
import styles from './DatePicker.module.css'

/** The 6 × 7 grid of a month, Monday first (European week), with the neighbouring months' days to fill it. */
function monthGrid(firstKey) {
  const offset = weekdayIndex(firstKey)
  const start = addDays(firstKey, -offset)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

/**
 * 2026-11-23 (owner: "calendar picker"): a date field that shows the date in the app's format (e.g. "28 Nov 2026")
 * and opens a month calendar. `value` and `onChange` use 'YYYY-MM-DD' ('' when empty); days before `min` and after `max` are off.
 * Keyboard: arrows move a day or a week, Page Up/Down a month, Home/End the week, Enter picks, Escape closes.
 */
export default function DatePicker({ label, hint, error, name, value, onChange, min, max, placeholder, className, id, disabled }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { language } = usePreferences()
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [open, setOpen] = useState(false)
  const [focusKey, setFocusKey] = useState(() => value || (min && min > todayKey() ? min : todayKey()))
  const rootRef = useRef(null)
  const gridRef = useRef(null)
  const triggerRef = useRef(null)

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + index))),
  )
  const monthLabel = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fromKey(monthStart(focusKey)))
  const days = monthGrid(monthStart(focusKey))
  const today = todayKey()
  const blocked = (key) => Boolean((min && key < min) || (max && key > max))

  function openCalendar() {
    setFocusKey(value || (min && min > today ? min : today))
    setOpen(true)
  }

  function close(returnFocus = true) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function pick(key) {
    if (blocked(key)) return
    onChange(key)
    close()
  }

  // Outside clicks close it; the focused day follows the keyboard.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) close(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) gridRef.current?.querySelector(`[data-day="${focusKey}"]`)?.focus()
  }, [open, focusKey])

  function onGridKeyDown(event) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (moves[event.key]) setFocusKey((key) => addDays(key, moves[event.key]))
    else if (event.key === 'PageUp') setFocusKey((key) => shiftMonth(key, -1))
    else if (event.key === 'PageDown') setFocusKey((key) => shiftMonth(key, 1))
    else if (event.key === 'Home') setFocusKey((key) => addDays(key, -weekdayIndex(key)))
    else if (event.key === 'End') setFocusKey((key) => addDays(key, 6 - weekdayIndex(key)))
    else if (event.key === 'Escape') close()
    else return
    event.preventDefault()
  }

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <div ref={rootRef} className={styles.root}>
          <button
            ref={triggerRef}
            id={fieldId}
            type="button"
            name={name}
            value={value}
            className={cx(fieldStyles.control, styles.trigger, invalid && fieldStyles.invalid, disabled && fieldStyles.disabled)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={() => (open ? close(false) : openCalendar())}
            data-date-picker={name}
          >
            <span className={value ? styles.value : styles.placeholder}>{value ? format.date(value) : (placeholder ?? t('common:datePicker.choose'))}</span>
            <Icon as={CalendarDays} size={16} className={styles.icon} />
          </button>
          {open && (
            <div className={styles.popover} role="dialog" aria-label={label ?? t('common:datePicker.choose')}>
              <div className={styles.head}>
                <button type="button" className={styles.nav} onClick={() => setFocusKey((key) => shiftMonth(key, -1))} aria-label={t('common:datePicker.previous')}>
                  <Icon as={ChevronLeft} size={16} />
                </button>
                <p className={styles.month} aria-live="polite">
                  {monthLabel}
                </p>
                <button type="button" className={styles.nav} onClick={() => setFocusKey((key) => shiftMonth(key, 1))} aria-label={t('common:datePicker.next')}>
                  <Icon as={ChevronRight} size={16} />
                </button>
              </div>
              <div className={styles.weekdays} aria-hidden="true">
                {weekdays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div ref={gridRef} className={styles.grid} role="grid" onKeyDown={onGridKeyDown}>
                {days.map((key) => {
                  const outside = key.slice(0, 7) !== focusKey.slice(0, 7)
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      tabIndex={key === focusKey ? 0 : -1}
                      className={cx(styles.day, outside && styles.outside, key === today && styles.today, key === value && styles.selected)}
                      aria-selected={key === value}
                      aria-label={format.date(key)}
                      disabled={blocked(key)}
                      onClick={() => pick(key)}
                      onFocus={() => setFocusKey(key)}
                      data-day={key}
                    >
                      {Number(key.slice(8))}
                    </button>
                  )
                })}
              </div>
              <div className={styles.foot}>
                <button type="button" className={styles.link} disabled={blocked(today)} onClick={() => pick(today)}>
                  {t('common:datePicker.today')}
                </button>
                {value && (
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => {
                      onChange('')
                      close()
                    }}
                  >
                    {t('common:datePicker.clear')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Field>
  )
}
