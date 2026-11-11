import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'

/**
 * Counts a number up from zero when it first appears, and from its old value to the new one when it changes (GSAP,
 * owner 2026-11-11). Works on numbers only (formatting is the caller's job, so no locale is guessed here); anything
 * else, or reduced motion, is returned as is.
 */
export function useCountUp(value) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animate = typeof value === 'number' && Number.isFinite(value) && !reduced

  const [shown, setShown] = useState(0)
  const counter = useRef({ n: 0 })

  useEffect(() => {
    if (!animate) return undefined
    // Keep the target's precision so decimals (e.g. 12.5) land exactly.
    const tween = gsap.to(counter.current, {
      n: value,
      duration: 0.9,
      ease: 'power3.out',
      onUpdate: () => setShown(counter.current.n),
      onComplete: () => setShown(value),
    })
    return () => tween.kill()
  }, [animate, value])

  return animate ? shown : value
}
