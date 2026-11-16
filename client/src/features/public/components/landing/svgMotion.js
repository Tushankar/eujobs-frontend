import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

gsap.registerPlugin(DrawSVGPlugin)

/*
 * Motion of the public pages' decorative SVGs (owner 2026-11-13: "all the SVGs, high level"; scroll-triggered, never
 * pinned or scrubbed). Inline SVGs carry data-svg:
 *   circuit  the traces draw themselves in (outline first, then the fill), then light pulses run along them;
 *   icon     the strokes draw in when the icon scrolls into view (the landing page's line icons).
 * <img> glows (data-glow) breathe and drift. Called only without reduce motion.
 */
const SHAPES = 'path, circle, ellipse, rect, line, polyline, polygon'
const PULSE = '#0a6cf0'
const random = gsap.utils.random

/** The visible shapes: not inside defs, masks or clip paths, and not a gradient-filled backdrop. */
function shapesOf(root) {
  return [...root.querySelectorAll(SHAPES)].filter((shape) => !shape.closest('defs, mask, clipPath') && !(shape.getAttribute('fill') ?? '').startsWith('url('))
}

const stroked = (shape) => {
  const stroke = getComputedStyle(shape).stroke
  return stroke && stroke !== 'none'
}

/** A timeline that outlines every shape, then fills the filled ones; it plays when `trigger` scrolls in. */
function traceIn(root, { trigger = root, amount = 1.4, duration = 1.1, delay = 0 } = {}) {
  const shapes = shapesOf(root)
  if (!shapes.length) return null
  const timeline = gsap.timeline({ delay, scrollTrigger: { trigger, start: 'top 88%', once: true } })
  shapes.forEach((shape, index) => {
    const at = (index / shapes.length) * amount
    if (stroked(shape)) {
      timeline.fromTo(shape, { drawSVG: '0%' }, { drawSVG: '100%', duration, ease: 'power2.inOut' }, at)
      return
    }
    const fill = getComputedStyle(shape).fill
    gsap.set(shape, { stroke: fill, strokeWidth: 0.9, fillOpacity: 0 })
    timeline
      .fromTo(shape, { drawSVG: '0%' }, { drawSVG: '100%', duration, ease: 'power2.inOut' }, at)
      .to(shape, { fillOpacity: 1, strokeWidth: 0, duration: 0.6, ease: 'power1.out' }, at + duration * 0.7)
  })
  return timeline
}

/** A slow, endless float of a whole pattern. */
function drift(element, distance = 10) {
  gsap.to(element, { x: random(-distance, distance), y: random(-distance * 0.8, distance * 0.8), duration: random(9, 14), ease: 'sine.inOut', repeat: -1, yoyo: true })
}

/** Light pulses along the `count` longest traces: a glowing copy shows a short dash that runs to the end and repeats. */
function pulses(root, { count = 8, width = 1.6, start = 0, color = PULSE, glow = `0 0 2px ${PULSE}` } = {}) {
  const traces = shapesOf(root)
    .filter((shape) => shape.getTotalLength?.() > 40)
    .sort((a, b) => b.getTotalLength() - a.getTotalLength())
    .slice(0, count)
  return traces.map((trace) => {
    const pulse = trace.cloneNode()
    pulse.removeAttribute('id')
    pulse.setAttribute('fill', 'none')
    pulse.setAttribute('data-pulse', '')
    pulse.style.filter = `drop-shadow(${glow})`
    trace.after(pulse)
    gsap.set(pulse, { stroke: color, strokeWidth: width, strokeLinecap: 'round', fillOpacity: 0, opacity: 0.9, drawSVG: '0% 0%' })
    gsap.fromTo(pulse, { drawSVG: '0% 7%' }, { drawSVG: '93% 100%', duration: random(1.6, 2.8), ease: 'none', repeat: -1, repeatDelay: random(0.6, 3.2), delay: start + random(0, 2.5) })
    return pulse
  })
}

/** Sets up every decorative SVG under `scope`; returns a cleanup that removes the pulse copies it added. */
export function animateSvgs(scope) {
  const q = gsap.utils.selector(scope)
  const added = []

  // Pulses start once the circuit has traced itself in.
  q('[data-svg="circuit"]').forEach((element) => {
    const intro = traceIn(element, { trigger: element.closest('section') ?? element, amount: 1.2, duration: 1 })
    const start = () => added.push(...pulses(element))
    if (intro) intro.eventCallback('onComplete', start)
    else start()
    drift(element.firstElementChild, 6)
  })

  q('[data-svg="icon"]').forEach((element) => {
    const lines = shapesOf(element).filter(stroked)
    gsap.fromTo(lines, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, stagger: 0.12, ease: 'power2.inOut', scrollTrigger: { trigger: element, start: 'top 92%', once: true } })
  })

  q('[data-glow]').forEach((glow, index) => {
    gsap.fromTo(glow, { opacity: 0.7, scale: 0.94 }, { opacity: 1, scale: 1.08, x: index % 2 ? -40 : 40, duration: random(6, 9), ease: 'sine.inOut', repeat: -1, yoyo: true, delay: index * 0.4 })
  })

  // Pulses made after the trace-in sit outside the GSAP context, so their endless tweens are killed here too.
  return () =>
    added.forEach((pulse) => {
      gsap.killTweensOf(pulse)
      pulse.remove()
    })
}
