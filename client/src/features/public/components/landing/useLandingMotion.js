import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin)

/*
 * Landing page motion (owner 2026-11-11: GSAP, premium and restrained). Targets are marked in the markup:
 *   data-hero-header, data-hero-line (inside an overflow-hidden line), data-hero-fade, data-hero-art (its children
 *   are the photo cards), data-parallax="<px>" (drifts while the hero scrolls away), data-twinkle, data-float,
 *   data-marquee (a track holding its items twice), data-reveal (children rise in once on scroll), data-stagger
 *   (children rise in as a batch), data-wipe (image unveils), data-zoom (photo settles from a slight zoom).
 * With "reduce motion" on (phones often switch it on in battery saver) elements still fade in, but nothing moves,
 * drifts, zooms or loops: the accessible version of the same page.
 */
const CONDITIONS = { full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }
const ease = 'power3.out'

/** Hero entrance, parallax, ambient loops, the logo marquee and smooth in-page links: set up once. */
function useHeroMotion(scope) {
  useGSAP(
    () => {
      const q = gsap.utils.selector(scope)
      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, ({ conditions }) => {
        const move = conditions.reduce ? 0 : 1
        gsap
          .timeline({ defaults: { ease, duration: 0.9 } })
          .from(q('[data-hero-header]'), { y: -24 * move, opacity: 0, duration: 0.7 })
          .from(q('[data-hero-line]'), move ? { yPercent: 110, stagger: 0.12, duration: 1 } : { opacity: 0, stagger: 0.12 }, '-=0.35')
          .from(q('[data-hero-fade]'), { y: 24 * move, opacity: 0, stagger: 0.1 }, '-=0.6')
          .from(q('[data-hero-art] > *'), { y: 40 * move, opacity: 0, scale: move ? 0.96 : 1, stagger: 0.06, duration: 0.8 }, 0.35)
        if (!move) return

        q('[data-parallax]').forEach((element) => {
          gsap.to(element, {
            y: Number(element.dataset.parallax),
            ease: 'none',
            scrollTrigger: { trigger: element.closest('section'), start: 'top top', end: 'bottom top', scrub: 0.6 },
          })
        })
        q('[data-twinkle]').forEach((element, index) => gsap.to(element, { opacity: 0.15, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.6 + index * 0.3 }))
        q('[data-float]').forEach((element, index) =>
          gsap.to(element, { y: index % 2 ? 10 : -10, rotation: index % 2 ? -6 : 6, duration: 5 + index, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
        )
        q('[data-marquee]').forEach((track) => {
          const loop = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 })
          track.addEventListener('mouseenter', () => loop.timeScale(0.15))
          track.addEventListener('mouseleave', () => loop.timeScale(1))
        })
      })

      const root = scope.current
      const onClick = (event) => {
        const link = event.target.closest('a[href^="#"]')
        const target = link && document.querySelector(link.getAttribute('href'))
        if (!target) return
        event.preventDefault()
        const reduce = window.matchMedia(CONDITIONS.reduce).matches
        gsap.to(window, { duration: reduce ? 0 : 1, scrollTo: { y: target, offsetY: 24 }, ease: 'power3.inOut' })
        history.replaceState(null, '', link.getAttribute('href'))
      }
      root.addEventListener('click', onClick)
      return () => root.removeEventListener('click', onClick)
    },
    { scope },
  )
}

/** Scroll reveals; re-run once the live jobs and FAQs are in the page (`ready`). */
function useScrollReveals(scope, ready) {
  useGSAP(
    () => {
      if (!ready) return
      const q = gsap.utils.selector(scope)
      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, ({ conditions }) => {
        const move = conditions.reduce ? 0 : 1
        q('[data-reveal]').forEach((element) => {
          gsap.from(element.children, { y: 36 * move, opacity: 0, stagger: 0.12, duration: 0.9, ease, scrollTrigger: { trigger: element, start: 'top 97%', once: true } })
        })
        q('[data-stagger]').forEach((group) => {
          const items = gsap.utils.toArray(group.children)
          gsap.set(items, { y: 40 * move, opacity: 0 })
          ScrollTrigger.batch(items, {
            start: 'top 97%',
            once: true,
            onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease, overwrite: true }),
          })
        })
        q('[data-wipe]').forEach((element) => {
          const trigger = { trigger: element, start: 'top 85%', once: true }
          if (move) {
            gsap.fromTo(element, { clipPath: 'inset(0% 0% 100% 0% round 14px)' }, { clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 1.2, ease: 'power4.out', scrollTrigger: trigger })
          } else {
            gsap.from(element, { opacity: 0, duration: 0.8, scrollTrigger: trigger })
          }
        })
        if (move) {
          q('[data-zoom]').forEach((element) => {
            gsap.from(element, { scale: 1.12, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } })
          })
        }
        ScrollTrigger.refresh()
      })
    },
    { scope, dependencies: [ready], revertOnUpdate: true },
  )
}

export function useLandingMotion(scope, ready) {
  useHeroMotion(scope)
  useScrollReveals(scope, ready)
}

/** Counts a number up when it scrolls into view (shown directly under reduce motion); `render(n)` gives the text. */
export function useCountUp(ref, value, render) {
  useGSAP(
    () => {
      const element = ref.current
      if (!element || value == null) return
      element.textContent = render(value)
      if (value === 0 || window.matchMedia(CONDITIONS.reduce).matches) return
      const counter = { n: 0 }
      gsap.to(counter, {
        n: value,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 97%', once: true },
        onStart: () => {
          element.textContent = render(0)
        },
        onUpdate: () => {
          element.textContent = render(Math.round(counter.n))
        },
      })
    },
    { dependencies: [value] },
  )
}
