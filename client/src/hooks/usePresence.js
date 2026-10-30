import { useEffect, useState } from 'react'

/**
 * Keeps a conditionally shown element mounted for `exitMs` after `open` turns false, so its exit
 * animation can play. Keep `exitMs` in sync with the CSS exit duration. Returns:
 *   mounted - render the element while true
 *   closing - true during the exit; apply the exit animation (and make the element inert)
 * With reduced motion there is no exit animation, so it unmounts at once.
 */
export function usePresence(open, exitMs) {
  const [mounted, setMounted] = useState(open)
  // Mount in the same render that opens, so the entrance animation isn't a frame late.
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open || !mounted) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setMounted(false), reduced ? 0 : exitMs)
    return () => window.clearTimeout(timer)
  }, [open, mounted, exitMs])

  return { mounted, closing: mounted && !open }
}
