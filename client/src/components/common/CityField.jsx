import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { errorCode, useGetConfigQuery, useGetPlaceSuggestionsQuery, useLazyGetPlaceQuery } from '@/app/api.js'
import { Button, Icon } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import fieldStyles from '@/components/ui/Field.module.css'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './CityField.module.css'

const DEBOUNCE_MS = 250

/**
 * A city picked through the Places proxy (G-1, §2.16): suggestions in the UI language, EU 27 + UK only, and
 * never a request to Google from the browser. One session token per typing session: created on focus and
 * ended by the details call when a city is picked. `value` is { countryCode, city, placeId } or null;
 * typing clears it, so a form only ever holds a picked city.
 */
export default function CityField({ label, hint, error, value, onChange, name = 'city' }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const id = useId()
  const display = (place) => (place ? t('common:city.value', { city: place.city, country: format.country(place.countryCode) }) : '')
  const [text, setText] = useState(() => display(value))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [sessionToken, setSessionToken] = useState(null)
  const [pickError, setPickError] = useState(null)
  const [resolvePlace, { isFetching: resolving }] = useLazyGetPlaceQuery()

  // A value set from outside (the saved profile, a pick) shows as "City, Country".
  const shown = display(value)
  const [syncedShown, setSyncedShown] = useState(shown)
  if (shown !== syncedShown) {
    setSyncedShown(shown)
    if (shown) setText(shown)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [text])

  const minLength = config?.limits.places.input.min
  const searching = Boolean(open && !value && sessionToken && minLength && query.length >= minLength)
  const {
    data: suggestions = [],
    error: searchError,
    isFetching,
    refetch,
  } = useGetPlaceSuggestionsQuery({ input: query, sessionToken }, { skip: !searching })
  const options = searching && !isFetching && !searchError ? suggestions : []

  function handleInput(event) {
    setText(event.target.value)
    setOpen(true)
    setActive(-1)
    setPickError(null)
    if (value) onChange(null)
  }

  async function pick(suggestion) {
    setOpen(false)
    try {
      const place = await resolvePlace({ placeId: suggestion.placeId, sessionToken }).unwrap()
      onChange({ countryCode: place.countryCode, city: place.city, placeId: place.placeId })
      // The details call ended this typing session; the next focus starts a new one.
      setSessionToken(null)
    } catch (failure) {
      setPickError(failure)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (options.length) setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault()
      pick(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  let status = null
  if (searching && isFetching) status = <span>{t('common:city.searching')}</span>
  else if (searching && searchError)
    status = (
      <>
        <span>{errorText.code(searchError)}</span>
        {errorCode(searchError) !== 'RATE_LIMITED' && (
          <Button variant="secondary" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={refetch}>
            {t('common:city.retry')}
          </Button>
        )}
      </>
    )
  else if (searching && suggestions.length === 0) status = <span>{t('common:city.noResults')}</span>
  const listOpen = open && (status || options.length > 0)
  const optionId = (index) => `${id}-option-${index}`

  return (
    <Field id={id} label={label ?? t('common:city.label')} hint={hint ?? t('common:city.hint')} error={error ?? (pickError && errorText.code(pickError))}>
      {({ describedBy, invalid }) => (
        <div className={styles.root}>
          <div className={cx(fieldStyles.control, invalid && fieldStyles.invalid)}>
            <span className={fieldStyles.leading}>
              <Icon as={MapPin} size={16} />
            </span>
            <input
              id={id}
              name={name}
              className={fieldStyles.input}
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={Boolean(listOpen)}
              aria-controls={`${id}-list`}
              aria-activedescendant={open && options[active] ? optionId(active) : undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              aria-busy={resolving || undefined}
              placeholder={t('common:city.placeholder')}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setSessionToken((current) => current ?? crypto.randomUUID())
                if (!value) setOpen(true)
              }}
              onBlur={() => setOpen(false)}
            />
          </div>
          {listOpen && (
            <ul id={`${id}-list`} role="listbox" className={styles.list}>
              {status && (
                <li role="presentation" className={styles.status}>
                  {status}
                </li>
              )}
              {options.map((suggestion, index) => (
                <li
                  key={suggestion.placeId}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={cx(styles.option, index === active && styles.active)}
                  // Keep the focus in the input so the click lands before blur closes the list.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(suggestion)}
                >
                  <span className={styles.city}>{suggestion.city}</span>
                  {suggestion.secondary && <span className={styles.secondary}>{suggestion.secondary}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}
