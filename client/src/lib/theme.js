import { useSyncExternalStore } from 'react'
import { useSelector } from 'react-redux'
import { useGetMeQuery, useUpdateMeMutation } from '@/app/api.js'

/*
 * The colour theme (owner 2026-11-16): light by default. The choice is kept on this device (localStorage, read by
 * index.html before the first paint) and, when signed in, on the account (PATCH /me), which wins after sign-in.
 */
const KEY = 'lwm-pref-theme'
const listeners = new Set()
let current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

/** Paints the page in `theme` and remembers it on this device. Unknown values are ignored. */
export function applyTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return
  try {
    window.localStorage.setItem(KEY, theme)
  } catch {
    // storage unavailable: the theme lasts for this page only
  }
  if (theme === current) return
  current = theme
  document.documentElement.dataset.theme = theme
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The current theme and `toggle`, which also saves the choice on the signed-in account. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  const signedIn = useSelector((state) => state.session.signedIn)
  const { data: me } = useGetMeQuery(undefined, { skip: !signedIn })
  const [updateMe] = useUpdateMeMutation()

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    if (me) updateMe({ theme: next })
  }

  return { theme, toggle }
}
