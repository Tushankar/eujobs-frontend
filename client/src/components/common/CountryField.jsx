import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import fieldStyles from '@/components/ui/Field.module.css'
import { cx } from '@/utils/cx.js'
import styles from './CountryField.module.css'

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** useCountryOptions() rows as CountryField options, grouped EU + UK, Remote, then the rest of the world. */
export const countryChoices = (countries) =>
  countries.map((country) => ({
    value: country.code,
    label: country.name,
    group: country.isRemote ? undefined : (country.isEu ?? true) || country.code === 'GB' ? 'europe' : 'world',
  }))

/**
 * A country picker that replaces the native <select> (worldwide since 2026-11-16: about 240 countries made the browser
 * list run off the page). The field opens a panel with a search box (name in any case or accents, or the code) and a
 * short list under "EU & UK" and "Rest of the world"; ↑ ↓ Enter and Escape work, and the panel opens upwards when
 * there is no room below. `options` = [{ value, label, group? }]; `onChange` gets the value. variant="filter" is the pill
 * of a list toolbar, like SelectField's.
 */
export default function CountryField({ label, hint, error, options, value, onChange, placeholder, name, variant, disabled, className, id }) {
  const { t } = useTranslation()
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const listId = `${fieldId}-list`
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef(null)
  const button = useRef(null)
  const list = useRef(null)

  const term = fold(query)
  const shown = term ? options.filter((option) => fold(option.label).includes(term) || String(option.value).toLowerCase() === term) : options
  const selected = options.find((option) => option.value === value)
  const filter = variant === 'filter'
  const applied = filter && value !== '' && value !== undefined && value !== options[0]?.value

  function show() {
    const rect = button.current.getBoundingClientRect()
    setUp(window.innerHeight - rect.bottom < 340 && rect.top > window.innerHeight - rect.bottom)
    setQuery('')
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }
  function close(refocus) {
    setOpen(false)
    if (refocus) button.current?.focus()
  }
  function pick(option) {
    onChange(option.value)
    close(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => !root.current?.contains(event.target) && close(false)
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Keep the highlighted country in view (the chosen one when the panel opens).
  useLayoutEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!shown.length) return
      setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (shown[active]) pick(shown[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  const heading = (option, index) => {
    if (term || !option.group || shown[index - 1]?.group === option.group) return null
    return (
      <li key={`group-${option.group}`} role="presentation" className={styles.group}>
        {t(`common:countryGroups.${option.group}`)}
      </li>
    )
  }

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <div ref={root} className={styles.root}>
          <button
            ref={button}
            id={fieldId}
            type="button"
            name={name}
            value={value ?? ''}
            disabled={disabled}
            className={cx(fieldStyles.control, styles.trigger, filter && fieldStyles.filter, applied && fieldStyles.applied, invalid && fieldStyles.invalid)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onClick={() => (open ? close(false) : show())}
            onKeyDown={(event) => !open && ['ArrowDown', 'ArrowUp'].includes(event.key) && (event.preventDefault(), show())}
          >
            <span className={cx(styles.value, !selected && styles.placeholder)}>{selected?.label ?? placeholder ?? ''}</span>
            <span className={fieldStyles.trailing}>
              <Icon as={ChevronDown} size={14} className={cx(styles.chevron, open && styles.flipped)} />
            </span>
          </button>
          {open && (
            <div className={cx(styles.panel, up && styles.up)}>
              <label className={styles.search}>
                <Icon as={Search} size={15} />
                <input
                  autoFocus
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                  aria-label={t('shell:country.search')}
                  placeholder={t('shell:country.search')}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKeyDown}
                />
              </label>
              <ul ref={list} id={listId} role="listbox" aria-label={label} className={styles.list}>
                {shown.map((option, index) => [
                  heading(option, index),
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={option.value === value}
                    className={cx(styles.option, index === active && styles.active, option.value === value && styles.selected)}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(option)}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.value === value && <Icon as={Check} size={14} />}
                  </li>,
                ])}
                {shown.length === 0 && <li className={styles.empty}>{t('shell:country.none')}</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </Field>
  )
}
