import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const CONDITIONS = { full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }
const ease = 'power3.out'

/*
 * Dashboard motion (GSAP, owner 2026-11-11; lighter than the landing page). On every route:
 *  - the page's sections rise in one after another (a page renders one wrapper or several sibling sections);
 *  - the PageTitle heading rises through its mask (data-motion-title);
 *  - cards marked `data-motion-card` (Panel, StatCard, GetStartedCard, EmptyState, DataTable rows) rise and settle
 *    from a slight scale, a few at a time, when they scroll into view, including ones that appear later, e.g. when
 *    data replaces a skeleton.
 * Under reduce motion everything only fades. Animated properties are cleared afterwards, so layouts and sticky columns are untouched.
 */
export function useWorkspaceMotion(content, pathname) {
  useGSAP(
    () => {
      const root = content.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, ({ conditions }) => {
        const move = conditions.reduce ? 0 : 1
        const sections = root.children.length === 1 ? [...root.firstElementChild.children] : [...root.children]
        gsap.from(sections, { y: 28 * move, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease, clearProps: 'transform,opacity,visibility' })
        gsap.from(gsap.utils.toArray('[data-motion-title]', root), move ? { yPercent: 105, duration: 0.85, ease: 'power4.out', delay: 0.05 } : { autoAlpha: 0, duration: 0.6 })

        const seen = new WeakSet()
        const reveal = (cards) => {
          const fresh = cards.filter((card) => !seen.has(card))
          if (!fresh.length) return
          fresh.forEach((card) => seen.add(card))
          gsap.set(fresh, { y: 30 * move, scale: move ? 0.97 : 1, autoAlpha: 0 })
          ScrollTrigger.batch(fresh, {
            start: 'top 96%',
            once: true,
            onEnter: (batch) => gsap.to(batch, { y: 0, scale: 1, autoAlpha: 1, duration: 0.7, stagger: 0.07, delay: 0.12, ease, overwrite: true, clearProps: 'transform,opacity,visibility' }),
          })
        }

        // Cards on screen come in right after their section; the ones below wait for the scroll.
        reveal(gsap.utils.toArray('[data-motion-card]', root))

        // Later cards (data arriving, tabs, pagination) rise in as they show up.
        let queued = []
        let frame = 0
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node.nodeType !== 1) continue
              if (node.matches('[data-motion-card]')) queued.push(node)
              queued.push(...node.querySelectorAll('[data-motion-card]'))
            }
          }
          if (queued.length && !frame) {
            frame = requestAnimationFrame(() => {
              reveal(queued)
              queued = []
              frame = 0
            })
          }
        })
        observer.observe(root, { childList: true, subtree: true })
        return () => {
          observer.disconnect()
          cancelAnimationFrame(frame)
        }
      })
    },
    { scope: content, dependencies: [pathname], revertOnUpdate: true },
  )
}
