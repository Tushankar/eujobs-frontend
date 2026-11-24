import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

/**
 * A list page's search, filters and sort kept in the URL (perf 2026-11-24), so Back from a detail page returns to the
 * same list. `state` maps parameter names to strings ('' leaves the parameter out); other parameters stay as they are.
 * The URL is replaced, never pushed, so typing doesn't add history entries.
 */
export function useUrlState(state) {
  const [params, setParams] = useSearchParams()
  const wanted = JSON.stringify(state)
  useEffect(() => {
    const next = new URLSearchParams(params)
    for (const [name, value] of Object.entries(JSON.parse(wanted))) {
      if (value) next.set(name, value)
      else next.delete(name)
    }
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [wanted, params, setParams])
}

/** Link state for a card that opens a detail page: where its Back link returns (the list with its search). */
export function useBackState() {
  const { pathname, search } = useLocation()
  return { back: pathname + search }
}

/** A detail page's Back target: the list it was opened from when that list is under `fallback`, else `fallback`. */
export function useBackTo(fallback) {
  const back = useLocation().state?.back
  return typeof back === 'string' && back.startsWith(fallback) ? back : fallback
}
