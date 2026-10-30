import { useMemo } from 'react'
import { useGetCountriesQuery } from '@/app/api.js'
import { usePreferences, useFormat } from './preferences.js'

/** M-135: the sign-up default — the browser's region when it is one of the options, else Remote. */
export function browserCountry(options) {
  const region = new Intl.Locale(navigator.language).maximize().region
  return options.some((option) => option.code === region) ? region : 'REMOTE'
}

/** The 29 countries (M-139) as { code, name }, sorted by name in the UI language with Remote last. */
export function useCountryOptions() {
  const { data: countries = [] } = useGetCountriesQuery()
  const { language } = usePreferences()
  const format = useFormat()
  return useMemo(
    () =>
      countries
        .map((country) => ({ code: country.code, name: format.country(country.code), isRemote: country.isRemote }))
        .sort((a, b) => Number(a.isRemote) - Number(b.isRemote) || a.name.localeCompare(b.name, language)),
    [countries, format, language],
  )
}
