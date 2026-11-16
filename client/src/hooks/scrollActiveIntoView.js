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
