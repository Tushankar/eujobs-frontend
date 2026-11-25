/*
 * Alignment check (owner 2026-11-25: "check for full issues like this", after the overview's "This week" select sat
 * 3px below its view toggle with its text pinned to the top). On the open page (or its open dialog) it reports:
 *   1. controls side by side in one row that share no edge or centre (top, middle and bottom all off by > 1.5px),
 *   2. controls side by side whose heights differ by 2 to 12px (a 28px toggle next to a 36px select),
 *   3. single-line text, or an icon, off the vertical centre of its control,
 *   4. an icon and its text in one control off each other's centre.
 * Returns strings, each naming the elements as "tag.localClass "text"". The route sweep runs rule 1 only: the first
 * audit (2026-11-25) found rules 2–4 mostly on deliberate layouts (a 36px icon button centred beside a 32px pill, a
 * bell's corner badge, a title over its progress bar), so they run with `{ all: true }` for an audit by hand.
 */
export function checkAlignment(page, { all = false } = {}) {
  return page.evaluate((all) => {
    const problems = []
    const SLACK = 1.5
    const modal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')].at(-1)
    const scope = modal || document.body
    const normal = (text) => (text ?? '').replace(/\s+/g, ' ').trim()
    const describe = (element) => {
      const text = normal(element.textContent || element.getAttribute('aria-label') || element.value).slice(0, 40)
      const name = element.tagName.toLowerCase() + [...element.classList].map((c) => `.${c.match(/^_?([A-Za-z][A-Za-z0-9]*)/)?.[1] ?? c}`).join('')
      return `${name} "${text}"`
    }
    const shown = (element) => {
      for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
        if (style.clipPath.startsWith('inset(50%') || (style.clip !== 'auto' && style.position === 'absolute')) return false
      }
      const rect = element.getBoundingClientRect()
      return rect.width > 1 && rect.height > 1
    }
    // A control mid-animation (hover lift, entrance slide) is not judged.
    const moving = (element) => {
      for (let node = element; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.transform !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(style.transform)) return true
        if (style.translate !== 'none' && style.translate !== '0px') return true
      }
      return false
    }

    const CONTROLS = [
      'button',
      'select',
      'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]):not([type=color])',
      '[role=group]',
      '[role=tablist]',
      '[role=combobox]',
      'a[class*="button" i]',
      'a[class*="btn" i]',
      'a[class*="pill" i]',
    ].join(',')
    const controls = [...scope.querySelectorAll(CONTROLS)].filter((element) => shown(element) && !moving(element) && !element.closest('[aria-hidden="true"]'))
    // Inner buttons of a group or tab list are judged by their group.
    const outer = controls.filter((element) => !controls.some((other) => other !== element && other.contains(element) && other.matches('[role=group], [role=tablist]')))
    const rects = new Map(outer.map((element) => [element, element.getBoundingClientRect()]))

    // 1 + 2: neighbours in one row (overlapping vertically, at most 40px apart, neither inside the other).
    const seen = new Set()
    for (const a of outer) {
      const ra = rects.get(a)
      if (ra.height < 16 || ra.height > 64) continue
      for (const b of outer) {
        if (a === b || a.contains(b) || b.contains(a)) continue
        const rb = rects.get(b)
        if (rb.height < 16 || rb.height > 64) continue
        const gap = rb.left - ra.right
        if (gap < -1 || gap > 40) continue
        const overlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
        if (overlap < Math.min(ra.height, rb.height) * 0.5) continue
        const key = `${describe(a)}|${describe(b)}`
        if (seen.has(key)) continue
        seen.add(key)
        const top = Math.abs(ra.top - rb.top)
        const middle = Math.abs(ra.top + ra.height / 2 - (rb.top + rb.height / 2))
        const bottom = Math.abs(ra.bottom - rb.bottom)
        const heights = Math.abs(ra.height - rb.height)
        if (top > SLACK && middle > SLACK && bottom > SLACK) {
          problems.push(`row misaligned: ${describe(a)} [${Math.round(ra.top)}+${Math.round(ra.height)}] vs ${describe(b)} [${Math.round(rb.top)}+${Math.round(rb.height)}]`)
        } else if (all && heights >= 2 && heights <= 12) {
          problems.push(`uneven heights in a row: ${describe(a)} ${Math.round(ra.height)}px vs ${describe(b)} ${Math.round(rb.height)}px`)
        }
      }
    }

    // 3 + 4: content inside a control.
    const range = document.createRange()
    const textBoxes = (element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      const boxes = []
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || !shown(node.parentElement)) continue
        range.selectNodeContents(node)
        boxes.push(...[...range.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1))
      }
      return boxes
    }
    for (const control of all ? controls : []) {
      if (control.matches('select, input, [role=group], [role=tablist]')) continue
      const own = control.getBoundingClientRect()
      if (own.height < 16 || own.height > 64) continue
      const style = getComputedStyle(control)
      const top = own.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop)
      const bottom = own.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom)
      const centre = (top + bottom) / 2
      const texts = textBoxes(control)
      const icons = [...control.querySelectorAll('svg, img, [class*="icon" i]')].filter(shown).map((icon) => icon.getBoundingClientRect()).filter((rect) => rect.height >= 8 && rect.height < own.height)
      const oneLine = texts.length > 0 && Math.max(...texts.map((rect) => rect.top)) - Math.min(...texts.map((rect) => rect.top)) < 2
      if (oneLine) {
        const textMiddle = (Math.min(...texts.map((rect) => rect.top)) + Math.max(...texts.map((rect) => rect.bottom))) / 2
        // Only where the box leaves room around the line (a fixed-height control), not a box hugging its text.
        if (bottom - top > texts[0].height + 4 && Math.abs(textMiddle - centre) > 2) problems.push(`text off-centre (${(textMiddle - centre).toFixed(1)}px): ${describe(control)}`)
        for (const icon of icons) {
          const iconMiddle = icon.top + icon.height / 2
          if (Math.abs(iconMiddle - textMiddle) > 2 && icon.right <= own.right && icon.left >= own.left) problems.push(`icon off its text (${(iconMiddle - textMiddle).toFixed(1)}px): ${describe(control)}`)
        }
      } else if (!texts.length) {
        for (const icon of icons) {
          const iconMiddle = icon.top + icon.height / 2
          if (Math.abs(iconMiddle - (own.top + own.height / 2)) > 2) problems.push(`icon off-centre (${(iconMiddle - own.top - own.height / 2).toFixed(1)}px): ${describe(control)}`)
        }
      }
    }
    return [...new Set(problems)]
  }, all)
}
