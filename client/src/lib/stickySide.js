/**
 * Pinned side columns (`.sticky-side`, utilities.css), LinkedIn-style: a column shorter than the window sticks under
 * the header; a taller one scrolls with the page until its last card is in view and then sticks there, so no card is
 * ever cut off. Sets each column's `--sticky-top` from its height and the window height.
 */
const GAP = 24
const sized = new ResizeObserver((entries) => entries.forEach((entry) => fit(entry.target)))
let columns = []

function fit(column) {
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0
  const top = Math.min(header + GAP, window.innerHeight - column.offsetHeight - GAP)
  column.style.setProperty('--sticky-top', `${top}px`)
}

function scan() {
  const next = [...document.getElementsByClassName('sticky-side')]
  columns.filter((column) => !next.includes(column)).forEach((column) => sized.unobserve(column))
  next.filter((column) => !columns.includes(column)).forEach((column) => sized.observe(column))
  columns = next
}

export function startStickySide() {
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', () => columns.forEach(fit))
  scan()
}
