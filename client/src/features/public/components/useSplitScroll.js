import { useLayoutEffect, useRef } from 'react'

const GAP = 24
const WIDE = '(min-width: 900px)'

/**
 * The /jobs split view's scroll (owner 2026-11-26): the open job scrolls with the page while the list stays put; once
 * the job's end shows, the job stays and the list scrolls on. Both columns are CSS sticky (PublicJobsPage.module.css);
 * this only sets their offsets from the two heights and the window height (on open, resize and size changes), so no
 * code runs while scrolling. Picking another job starts it at its top, beside the list, which stays where it was.
 * `pick()` before a row click remembers where the list is on screen.
 */
export function useSplitScroll(jobId) {
  const layout = useRef(null)
  const list = useRef(null)
  // How far the list had scrolled under the navbar when the open job was picked; the job starts there.
  const listOffset = useRef(0)
  const pickedAt = useRef(null)

  useLayoutEffect(() => {
    const grid = layout.current
    const detail = grid?.querySelector('[data-detail]')
    if (!grid || !list.current || !detail) return
    const top = parseFloat(getComputedStyle(grid).getPropertyValue('--split-top'))

    function fit() {
      const room = window.innerHeight - top - GAP
      const listExtra = Math.max(0, list.current.offsetHeight - room)
      const detailExtra = Math.max(0, detail.offsetHeight - room)
      listOffset.current = Math.min(listOffset.current, listExtra)
      const vars = {
        '--split-height': list.current.offsetHeight + detailExtra,
        '--list-top': top - listOffset.current,
        '--detail-offset': listOffset.current,
        '--detail-top': top - detailExtra,
        '--detail-bottom': window.innerHeight - top - detail.offsetHeight,
      }
      Object.entries(vars).forEach(([name, value]) => grid.style.setProperty(name, `${value}px`))
    }

    // A list already pinned under the navbar keeps its place on screen; the page scrolls to where the new job starts.
    const listTop = pickedAt.current ?? list.current.getBoundingClientRect().top
    pickedAt.current = null
    const pinned = window.matchMedia(WIDE).matches && listTop <= top
    listOffset.current = pinned ? top - listTop : 0
    fit()
    if (pinned) window.scrollTo({ top: grid.getBoundingClientRect().top + window.scrollY - top + listOffset.current, behavior: 'instant' })

    const resized = new ResizeObserver(fit)
    resized.observe(list.current)
    resized.observe(detail)
    window.addEventListener('resize', fit)
    return () => {
      resized.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [jobId])

  const pick = () => {
    pickedAt.current = list.current?.getBoundingClientRect().top ?? null
  }
  return { layout, list, pick }
}
