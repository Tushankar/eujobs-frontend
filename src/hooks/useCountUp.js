import { useEffect, useRef, useState } from 'react'

const NUMBER = /^(\D*)(\d[\d,]*)(\D*)$/
const DURATION_MS = 600

/**
 * Counts a stat up from zero when it first appears, and from its old value to the new one when it changes.
 * Handles numbers and strings like "18", "1,284" or "7 yrs"; anything else (or reduced motion) is returned as is.
 */
export function useCountUp(value) {
  const match = NUMBER.exec(String(value))
  const target = match ? Number(match[2].replaceAll(',', '')) : null
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animate = target !== null && !reduced

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
      shownRef.current = Math.round(from + (target - from) * eased)
      setShown(shownRef.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, target])

  if (!animate) return value
  const digits = match[2].includes(',') ? shown.toLocaleString('en-US') : String(shown)
  return `${match[1]}${digits}${match[3]}`
}
