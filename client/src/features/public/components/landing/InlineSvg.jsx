import { useId, useMemo } from 'react'

/**
 * A bundled SVG file (imported with `?raw`) placed inline, so the landing motion can reach its shapes (stroke drawing,
 * pulses). Ids are prefixed per instance: the Figma exports reuse names such as `clip0_68_8827`, and inline ids are
 * global to the page. `currentColor` turns the export's white strokes into the text colour (icons tinted by CSS).
 * Only the project's own asset files go through here, never user content.
 */
export default function InlineSvg({ svg, className, style, motion, currentColor = false, ...rest }) {
  const prefix = useId().replace(/:/g, '')
  const html = useMemo(() => {
    const scoped = svg
      .replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
      .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`)
    return currentColor ? scoped.replace(/stroke="white"/g, 'stroke="currentColor"') : scoped
  }, [svg, prefix, currentColor])
  return <span className={className} style={style} aria-hidden="true" data-svg={motion} dangerouslySetInnerHTML={{ __html: html }} {...rest} />
}
