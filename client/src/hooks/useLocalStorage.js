import { useCallback, useState } from 'react'

/**
 * useState that persists to localStorage, only for the per-browser choices §2.15 allows (the dismissed overview
 * insight, the recruiter's match job); data lives on the server. Falls back to in-memory state if storage is blocked.
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? initialValue : JSON.parse(stored)
    } catch {
      return initialValue
    }
  })

  const update = useCallback(
    (next) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // storage unavailable: keep the in-memory value only
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}
