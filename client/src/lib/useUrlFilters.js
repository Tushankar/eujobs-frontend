import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const SEARCH_DEBOUNCE_MS = 300

/**
 * Table filters kept in the URL (admin lists, M-206): `setFilter(name, value)` sets or clears one parameter and goes
 * back to page 1 (except for `page` itself). React Router's updater only sees the last rendered URL, so the hook keeps
 * the URL it asked for until the next render: two quick changes never drop one another. The search text (`q`) is
 * also held locally, so typing faster than the URL updates loses no character.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  const pending = useRef(null)
  // The latest rendered URL, for the delayed search write (a filter picked meanwhile must survive it).
  const latest = useRef(params)
  const [search, setSearchText] = useState(params.get('q') ?? '')
  useEffect(() => {
    pending.current = null
    latest.current = params
  }, [params])

  const setFilter = (name, value) => {
    const next = new URLSearchParams(pending.current ?? latest.current)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    pending.current = next
    setParams(next, { replace: true })
  }
  // Perf 2026-11-24: the box shows each key at once; the URL (and so the request) follows 300 ms after typing stops.
  const searchTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])
  const setSearch = (value) => {
    setSearchText(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setFilter('q', value), SEARCH_DEBOUNCE_MS)
  }
  const clearFilters = () => {
    window.clearTimeout(searchTimer.current)
    pending.current = new URLSearchParams()
    setSearchText('')
    setParams({}, { replace: true })
  }
  return { params, setFilter, search, setSearch, clearFilters }
}
