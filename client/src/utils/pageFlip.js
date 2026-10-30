/*
 * Page flip between auth screens (sign in / sign up, candidate / recruiter). It runs on the View Transitions API
 * through react-router's `viewTransition` option; browsers without it, and users who prefer reduced motion,
 * navigate normally and the form just cascades in. The flip itself is styled in styles/utilities.css (.page-flip).
 */

/** Whether a navigation can be animated as a flip. */
export function canFlip() {
  return typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

let flipPending = false

/** Call as a flip navigation starts, so the screen it lands on doesn't also cascade its content in over the flip. */
export function markFlip() {
  if (!canFlip()) return
  flipPending = true
  // Cleared by a timer because the destination may reuse the mounted layout (same page component, new props).
  window.setTimeout(() => {
    flipPending = false
  }, 1500)
}

/** Whether the screen being mounted was reached by a flip. */
export function arrivedByFlip() {
  return flipPending
}
