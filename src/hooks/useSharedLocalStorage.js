import { useCallback, useSyncExternalStore } from 'react'

/*
 * Like useLocalStorage, but every component using the same key shares one value and
 * re-renders together (e.g. the sidebar badge and the Applications page). Values are
 * kept in memory too, so state still works when localStorage is blocked.
 */
const values = new Map()
const listeners = new Set()

function readValue(key, initialValue) {
  if (!values.has(key)) {
    let value = initialValue
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) value = JSON.parse(stored)
    } catch {
      // storage unavailable or corrupt: fall back to the initial value
    }
    values.set(key, value)
  }
  return values.get(key)
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSharedLocalStorage(key, initialValue) {
  const value = useSyncExternalStore(subscribe, () => readValue(key, initialValue))

  const update = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(readValue(key, initialValue)) : next
      values.set(key, resolved)
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // storage unavailable: keep the in-memory value only
      }
      listeners.forEach((listener) => listener())
    },
    [key, initialValue],
  )

  return [value, update]
}
