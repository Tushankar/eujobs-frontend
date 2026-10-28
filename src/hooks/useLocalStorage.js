import { useCallback, useState } from 'react'

/**
 * useState that persists to localStorage. The Figma footer states
 * "Changes saved on this device", so local persistence is the backing store
 * for every mock interaction. Falls back to in-memory state if storage is blocked.
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
