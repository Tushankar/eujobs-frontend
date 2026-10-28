import { useLayoutEffect } from 'react'

/**
 * Lets a CSS "pill" slide between the options of a switcher. Writes the active option's position to
 * `--indicator-x` / `--indicator-w` on the tray element and marks it `data-ready` after the first
 * placement, so the pill appears in place on mount and only glides on later changes.
 *
 * The active option is the child marked `aria-selected="true"` (tabs) or `aria-pressed="true"` (toggles).
 * Pass the selected value as `activeKey` so the pill follows it; it also re-measures when the tray resizes.
 */
export function useActiveIndicator(trayRef, activeKey) {
  useLayoutEffect(() => {
    const tray = trayRef.current
    if (!tray) return undefined

    function place() {
      const active = tray.querySelector('[aria-selected="true"], [aria-pressed="true"]')
      if (!active) return
      tray.style.setProperty('--indicator-x', `${active.offsetLeft}px`)
      tray.style.setProperty('--indicator-w', `${active.offsetWidth}px`)
      tray.dataset.ready = 'true'
    }

    place()
    const observer = new ResizeObserver(place)
    observer.observe(tray)
    return () => observer.disconnect()
  }, [trayRef, activeKey])
}
