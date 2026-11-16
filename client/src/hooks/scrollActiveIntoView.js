/**
 * A row of tabs or steps that scrolls sideways on a phone keeps its selected item on screen: scrolls the row (only
 * the row, never the page) just far enough to show the child marked selected, current or pressed.
 */
export function scrollActiveIntoView(row) {
  const active = row?.querySelector('[aria-selected="true"], [aria-pressed="true"], [aria-current="page"], [aria-current="step"]')
  if (!active || row.scrollWidth <= row.clientWidth) return
  // Positions within the row's scrollable content, whatever the row's offset parent is.
  const start = active.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft
  const end = start + active.getBoundingClientRect().width
  const margin = 24
  if (start < row.scrollLeft) row.scrollLeft = Math.max(0, start - margin)
  else if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth + margin
}

/**
 * Marks the edges where a sideways-scrolling row has more to show (`data-more-start` / `data-more-end`), so the
 * `.scroll-row` styles fade that edge and the row reads as swipeable. Returns the cleanup.
 */
export function trackRowEdges(row) {
  const update = () => {
    const max = row.scrollWidth - row.clientWidth
    row.toggleAttribute('data-more-start', row.scrollLeft > 1)
    row.toggleAttribute('data-more-end', max - row.scrollLeft > 1)
  }
  update()
  row.addEventListener('scroll', update, { passive: true })
  const observer = new ResizeObserver(update)
  observer.observe(row)
  return () => {
    row.removeEventListener('scroll', update)
    observer.disconnect()
  }
}

/** Callback ref for a tab row that remounts with its page: shows the selected tab and fades the edges with more. */
export function tabRowRef(row) {
  if (!row) return undefined
  scrollActiveIntoView(row)
  return trackRowEdges(row)
}
