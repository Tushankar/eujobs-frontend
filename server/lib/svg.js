import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import { AppError } from './errors.js'

/*
 * Company logos in SVG (M-150): DOMPurify's SVG profile removes scripts, event-handler attributes and
 * foreign content. A file whose sanitised result is no longer an <svg> element is refused like a wrong type.
 */
const purify = createDOMPurify(new JSDOM('').window)

/** True when the bytes are text that starts like an SVG document (file-type cannot detect SVG). */
export function looksLikeSvg(buffer) {
  const head = buffer.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart()
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)
}

export function sanitizeSvg(buffer) {
  const clean = purify.sanitize(buffer.toString('utf8'), { USE_PROFILES: { svg: true, svgFilters: true } })
  if (!/^<svg[\s>]/i.test(clean.trim())) throw new AppError('FILE_TYPE_NOT_ALLOWED')
  return Buffer.from(clean, 'utf8')
}
