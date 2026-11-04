import { readdirSync, readFileSync } from 'node:fs'

/*
 * Phase 11 checks for translated screens: English leftovers and long-text layout (text that spills out of its box,
 * is clipped or cut off, or overlaps other text). Both run in the page and return a list of problems.
 */
const LOCALES = new URL('../../client/src/i18n/locales/', import.meta.url)

const flatten = (node, prefix = '', out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') flatten(value, `${prefix}${key}.`, out)
    else out[`${prefix}${key}`] = value
  }
  return out
}
const catalogue = (language) =>
  Object.fromEntries(
    readdirSync(new URL(`${language}/`, LOCALES)).flatMap((file) =>
      Object.entries(flatten(JSON.parse(readFileSync(new URL(`${language}/${file}`, LOCALES), 'utf8')))).map(([key, value]) => [`${file}:${key}`, value]),
    ),
  )
const isStatic = (value) => typeof value === 'string' && !/\{\{|<\w+/.test(value)
const words = (value) => value.trim().split(/\s+/).length

/**
 * The texts a screen in `language` must not show (P11-01): every static en value of more than 3 words that the
 * language translates differently (a value both languages share is not a leftover), and the language's own static
 * values (used to tell a truncated UI label from truncated user data).
 */
export function textsFor(language) {
  const english = catalogue('en')
  const translated = catalogue(language)
  const leftovers = Object.entries(english)
    .filter(([key, value]) => isStatic(value) && words(value) > 3 && translated[key] !== value)
    .map(([, value]) => value.replace(/\s+/g, ' ').trim())
  const labels = Object.values(translated).filter(isStatic).map((value) => value.replace(/\s+/g, ' ').trim())
  return { leftovers: [...new Set(leftovers)], labels: [...new Set(labels)] }
}

/** English texts on the page (text, aria-label, placeholder, title, alt) that `texts.leftovers` lists. */
export function findLeftovers(page, texts) {
  return page.evaluate((leftovers) => {
    const wanted = new Set(leftovers)
    const normal = (text) => (text ?? '').replace(/\s+/g, ' ').trim()
    const found = new Set()
    for (const element of document.body.querySelectorAll('*')) {
      if (element.closest('script, style, noscript')) continue
      const text = normal(element.textContent)
      if (text && wanted.has(text)) found.add(`"${text}"`)
      for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
        const value = normal(element.getAttribute(name))
        if (value && wanted.has(value)) found.add(`${name} "${value}"`)
      }
    }
    if (wanted.has(normal(document.title))) found.add(`document.title "${document.title}"`)
    return [...found].map((text) => `English left: ${text}`)
  }, texts.leftovers)
}

/**
 * Long-text layout on the visible page (`root` limits it, e.g. to an open dialog). Every visible element with its
 * own text is checked:
 * - its text runs past its own box (a nowrap label wider than its button) or past the nearest ancestor that clips
 *   without scrolling (a scroll container is fine: tabs and tables may scroll);
 * - it is cut off vertically (overflow hidden, no line clamp);
 * - it ends in an ellipsis although it is a translated UI label (user data may be truncated: those are notes);
 * - its text overlaps another element's text.
 */
export function checkLayout(page, texts, root = 'body') {
  return page.evaluate(
    (rootSelector, labels) => {
      const uiLabels = new Set(labels)
      const problems = []
      const notes = []
      const scope = document.querySelector(rootSelector) ?? document.body
      const normal = (text) => (text ?? '').replace(/\s+/g, ' ').trim()
      const describe = (element) => {
        const text = normal(element.textContent).slice(0, 60)
        const name = element.tagName.toLowerCase() + ([...element.classList].map((c) => `.${c.replace(/_[\w-]+$/, '')}`).join('') || '')
        return `${name} "${text}"`
      }
      const shown = (element) => {
        for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
        }
        const rect = element.getBoundingClientRect()
        return rect.width > 1 && rect.height > 1
      }
      const textNodes = (element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      const elements = [...scope.querySelectorAll('*')].filter((element) => textNodes(element).length && shown(element))
      const range = document.createRange()
      const textRects = (element) =>
        textNodes(element).flatMap((node) => {
          range.selectNodeContents(node)
          return [...range.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1)
        })
      const pinned = (element) => {
        for (let node = element; node; node = node.parentElement) {
          const position = getComputedStyle(node).position
          if (position === 'fixed' || position === 'sticky') return node
        }
        return null
      }
      const SLACK = 1.5

      const boxes = []
      for (const element of elements) {
        const style = getComputedStyle(element)
        const rects = textRects(element)
        const own = element.getBoundingClientRect()
        // 1. Text past its own box (only for boxes that size their content; inline text flows in its parent).
        if (style.display !== 'inline' && style.display !== 'contents') {
          const right = Math.max(...rects.map((rect) => rect.right))
          const left = Math.min(...rects.map((rect) => rect.left))
          if (right > own.right + SLACK || left < own.left - SLACK) problems.push(`text spills out of its box: ${describe(element)} (${Math.round(Math.max(right - own.right, own.left - left))}px)`)
        }
        // 2. Clipped by the nearest ancestor that hides overflow without scrolling.
        for (let node = element; node && node !== document.body; node = node.parentElement) {
          const nodeStyle = getComputedStyle(node)
          const clipsX = ['hidden', 'clip'].includes(nodeStyle.overflowX)
          const clipsY = ['hidden', 'clip'].includes(nodeStyle.overflowY)
          if (!clipsX && !clipsY) continue
          const ellipsis = nodeStyle.textOverflow === 'ellipsis' && node === element
          const clamp = nodeStyle.webkitLineClamp && nodeStyle.webkitLineClamp !== 'none'
          const box = node.getBoundingClientRect()
          // A 1 px clip box is the visually-hidden pattern (screen-reader text), not a cut.
          if (box.width <= 2 || box.height <= 2) break
          const cutX = clipsX && rects.some((rect) => rect.right > box.right + SLACK || rect.left < box.left - SLACK)
          const cutY = clipsY && !clamp && rects.some((rect) => rect.bottom > box.bottom + SLACK || rect.top < box.top - SLACK)
          const truncated = ellipsis && element.scrollWidth > element.clientWidth + 1
          if (truncated) {
            const text = normal(element.textContent)
            if (uiLabels.has(text)) problems.push(`translated label cut with an ellipsis: ${describe(element)}`)
            else notes.push(`ellipsis (data): ${describe(element)}`)
          } else if (cutX || cutY) problems.push(`text cut off ${cutX ? 'horizontally' : 'vertically'}: ${describe(element)}`)
          break
        }
        boxes.push({ element, rects, pinned: pinned(element) })
      }

      // 3. Text over text: two elements whose text lines intersect (pinned bars only against their own kind).
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          if (a.element.contains(b.element) || b.element.contains(a.element) || Boolean(a.pinned) !== Boolean(b.pinned)) continue
          const hit = a.rects.some((ra) =>
            b.rects.some((rb) => Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 2 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 2),
          )
          if (hit) problems.push(`text overlaps: ${describe(a.element)} × ${describe(b.element)}`)
        }
      }
      return { problems: [...new Set(problems)], notes: [...new Set(notes)] }
    },
    root,
    texts.labels,
  )
}
