import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetCountriesQuery } from '@/app/api.js'
import { usePreferences, useFormat } from './preferences.js'

/**
 * The header picker's choices. A candidate's (owner 2026-11-16) are Worldwide, their own country ("Your country"),
 * Remote, then the other countries A–Z; everyone else's are the countries with Remote last.
 */
export function usePickerOptions() {
  const { t } = useTranslation()
  const { me, country } = usePreferences()
  const options = useCountryOptions()
  if (me?.role !== 'candidate') return options
  const own = options.find((option) => option.code === country && !option.isRemote)
  const remote = options.find((option) => option.isRemote)
  return [
    { code: 'WORLDWIDE', name: t('common:worldwide'), isRemote: false },
    ...(own ? [{ ...own, name: `${own.name} · ${t('shell:country.yours')}` }] : []),
    ...(remote ? [remote] : []),
    ...options.filter((option) => option !== own && option !== remote),
  ]
}

/**
 * EU + UK first, then Remote, then the rest of the world (owner 2026-11-16: "EU Jobs" first, then worldwide). Rows from
 * before the worldwide catalogue have no `isEu` and are all EU + UK, so they count as the first group.
 */
const rankOf = (country) => (country.isRemote ? 1 : (country.isEu ?? true) || country.code === 'GB' ? 0 : 2)

/** The countries (M-139, worldwide since 2026-11-16) as { code, name, isRemote, isEu }, each group A–Z in the UI language. */
export function useCountryOptions() {
  const { data: countries = [] } = useGetCountriesQuery()
  const { language } = usePreferences()
  const format = useFormat()
  return useMemo(
    () =>
      countries
        .map((country) => ({ code: country.code, name: format.country(country.code), isRemote: country.isRemote, isEu: country.isEu }))
        .sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name, language)),
    [countries, format, language],
  )
}

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** A search box over country options: by name (any case or accents) or by code ("US"). */
export function useCountrySearch(options) {
  const [query, setQuery] = useState('')
  const term = fold(query)
  const shown = term ? options.filter((option) => fold(option.name).includes(term) || option.code.toLowerCase() === term) : options
  return { query, setQuery, shown }
}

/** useCountryOptions() rows as CountryField options, grouped EU + UK, Remote, then the rest of the world. */
export const countryChoices = (countries) =>
  countries.map((country) => ({
    value: country.code,
    label: country.name,
    group: country.isRemote ? undefined : (country.isEu ?? true) || country.code === 'GB' ? 'europe' : 'world',
  }))
