import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 600

/**
 * Counts a number up from zero when it first appears, and from its old value to the new one when it changes.
 * Works on numbers only (formatting is the caller's job, so no locale is guessed here); anything else, or
 * reduced motion, is returned as is.
 */
export function useCountUp(value) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animate = typeof value === 'number' && Number.isFinite(value) && !reduced

  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    if (!animate) return undefined
    const from = shownRef.current
    const start = performance.now()
    let frame

    function tick(now) {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      const eased = 1 - (1 - progress) ** 3
      // Keep the target's precision so decimals (e.g. 12.5) land exactly.
      shownRef.current = progress === 1 ? value : from + (value - from) * eased
      setShown(shownRef.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, value])

  return animate ? shown : value
}
