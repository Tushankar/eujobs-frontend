import { useEffect } from 'react'

/**
 * The public website hides the page scrollbar (owner 2026-11-13); the page still scrolls with the wheel, touch and
 * keys. The class is on <html> only while a public page is mounted, so the workspaces keep their scrollbars.
 */
export function useHiddenScrollbar() {
  useEffect(() => {
    document.documentElement.classList.add('no-scrollbar')
    return () => document.documentElement.classList.remove('no-scrollbar')
  }, [])
}
