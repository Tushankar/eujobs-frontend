import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Table filters kept in the URL (admin lists, M-206): `setFilter(name, value)` sets or clears one parameter and goes
 * back to page 1 (except for `page` itself). React Router's updater only sees the last rendered URL, so the hook keeps
 * the URL it asked for until the next render: two quick changes never drop one another. The search text (`q`) is
 * also held locally, so typing faster than the URL updates loses no character.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  const pending = useRef(null)
  const [search, setSearchText] = useState(params.get('q') ?? '')
  useEffect(() => {
    pending.current = null
  }, [params])

  const setFilter = (name, value) => {
    const next = new URLSearchParams(pending.current ?? params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    pending.current = next
    setParams(next, { replace: true })
  }
  const setSearch = (value) => {
    setSearchText(value)
    setFilter('q', value)
  }
  const clearFilters = () => {
    pending.current = new URLSearchParams()
    setSearchText('')
    setParams({}, { replace: true })
  }
  return { params, setFilter, search, setSearch, clearFilters }
}
