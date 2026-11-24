import { useLayoutEffect } from 'react'

/**
 * The public website hides the page scrollbar (owner 2026-11-13); the page still scrolls with the wheel, touch and
 * keys. The class is on <html> only while a public page is mounted, so the workspaces keep their scrollbars.
 * A layout effect (perf 2026-11-24): set before the first paint, so the page doesn't shift sideways by half the
 * scrollbar gutter right after it appears.
 */
export function useHiddenScrollbar() {
  useLayoutEffect(() => {
    document.documentElement.classList.add('no-scrollbar')
    return () => document.documentElement.classList.remove('no-scrollbar')
  }, [])
}
