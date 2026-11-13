import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const CONDITIONS = { full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }
const ease = 'power3.out'
// A block taller than this is split into its children, so long lists and columns reveal piece by piece.
const MAX_BLOCK = 480
const MAX_DEPTH = 5

/**
 * The blocks under `parent` that reach below `fold`: the first descendants no taller than MAX_BLOCK (cards, rows,
 * list items, chart panels…), kept whole even when they straddle the fold, found by splitting taller elements.
 * Blocks fully above the fold are left to the entrance.
 */
function blocksBelow(parent, fold, out, depth = 0) {
  for (const child of parent.children) {
    const box = child.getBoundingClientRect()
    if (!box.height || box.bottom <= fold) continue
    const splittable = child.children.length > 0 && depth < MAX_DEPTH
    if (box.height <= MAX_BLOCK || !splittable) out.push(child)
    else blocksBelow(child, fold, out, depth + 1)
  }
  return out
}

/*
 * Dashboard motion (GSAP, owner 2026-11-11). On every route:
 *  - the sections on screen rise in one after another, and the PageTitle heading rises through its mask;
 *  - cards marked `data-motion-card` (Panel, StatCard, GetStartedCard, EmptyState, DataTable rows) rise and settle
 *    from a slight scale, a few at a time;
 *  - everything below the fold (any page's cards, rows and blocks, see blocksBelow) rises in as it scrolls into
 *    view, including content that arrives later (data replacing a skeleton, tabs, pagination).
 * Under reduce motion everything only fades. Only opacity and transform animate (never visibility), so content
 * waiting below the fold stays readable to screen readers and tests; both are cleared afterwards, so layouts and
 * sticky columns are untouched.
 */
export function useWorkspaceMotion(content, pathname) {
  useGSAP(
    () => {
      const root = content.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, ({ conditions }) => {
        const move = conditions.reduce ? 0 : 1
        const seen = new WeakSet()
        const isSeen = (element) => {
          for (let node = element; node && node !== root; node = node.parentElement) if (seen.has(node)) return true
          return false
        }

        const reveal = (elements) => {
          const fresh = elements.filter((element) => !isSeen(element))
          if (!fresh.length) return
          fresh.forEach((element) => seen.add(element))
          gsap.set(fresh, { y: 30 * move, scale: move ? 0.98 : 1, opacity: 0 })
          ScrollTrigger.batch(fresh, {
            start: 'top 94%',
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, { y: 0, scale: 1, opacity: 1, duration: 0.7, stagger: 0.07, ease, overwrite: true, clearProps: 'transform,opacity,visibility' }),
          })
        }

        // Measure before anything moves.
        const fold = window.innerHeight
        const page = root.children.length === 1 ? root.firstElementChild : root
        const sections = [...page.children]
        const below = blocksBelow(page, fold, [])
        const onScreen = sections.filter((section) => section.getBoundingClientRect().top < fold)

        gsap.from(onScreen, { y: 28 * move, opacity: 0, duration: 0.7, stagger: 0.08, ease, clearProps: 'transform,opacity,visibility' })
        gsap.from(gsap.utils.toArray('[data-motion-title]', root), move ? { yPercent: 105, duration: 0.85, ease: 'power4.out', delay: 0.05 } : { opacity: 0, duration: 0.6 })
        reveal(below)
        // Cards on screen come in right after their section.
        reveal(gsap.utils.toArray('[data-motion-card]', root).filter((card) => card.getBoundingClientRect().top < fold))

        // Content added later: below the window it waits for the scroll; on screen only its cards animate.
        let queued = []
        let frame = 0
        const flush = () => {
          frame = 0
          const nodes = queued.filter((node) => node.isConnected)
          queued = []
          const bottom = window.innerHeight
          const later = []
          const cards = []
          for (const node of nodes) {
            if (isSeen(node)) continue
            const box = node.getBoundingClientRect()
            if (box.top >= bottom) {
              if (box.height <= MAX_BLOCK || !node.children.length) later.push(node)
              else blocksBelow(node, bottom, later)
            } else {
              // Starts on screen (e.g. a whole list replacing its skeleton): its cards animate now, its parts
              // further down wait for the scroll.
              if (node.matches('[data-motion-card]')) cards.push(node)
              cards.push(...node.querySelectorAll('[data-motion-card]'))
              blocksBelow(node, bottom, later)
            }
          }
          reveal([...later, ...cards])
        }
        const observer = new MutationObserver((records) => {
          for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) queued.push(node)
          if (queued.length && !frame) frame = requestAnimationFrame(flush)
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
