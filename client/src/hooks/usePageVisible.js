import { useSyncExternalStore } from 'react'

const subscribe = (onChange) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/** True while the tab is visible; polling pauses in hidden tabs (M-094). */
export function usePageVisible() {
  return useSyncExternalStore(subscribe, () => document.visibilityState === 'visible')
}
