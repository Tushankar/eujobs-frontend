import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import { marked } from 'marked'

/*
 * Markdown to sanitised HTML (§2.1): marked renders, DOMPurify (on jsdom) removes anything unsafe.
 * Used for legal texts now and lesson text in Phase 8. Links must be https (U16) or site-relative.
 */
const purify = createDOMPurify(new JSDOM('').window)

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  const href = node.getAttribute('href') ?? ''
  if (!href.startsWith('https://') && !href.startsWith('/')) node.removeAttribute('href')
  if (href.startsWith('https://')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function renderMarkdown(markdown) {
  return purify.sanitize(marked.parse(markdown, { async: false }), { USE_PROFILES: { html: true } })
}
