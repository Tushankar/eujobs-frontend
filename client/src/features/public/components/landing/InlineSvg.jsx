import { useId, useMemo } from 'react'
import { scopeSvgIds } from '@/lib/svg.js'

/**
 * A bundled SVG file (imported with `?raw`) placed inline, so the landing motion can reach its shapes (stroke drawing,
 * pulses). Ids are prefixed per instance: the Figma exports reuse names such as `clip0_68_8827`, and inline ids are
 * global to the page. `currentColor` turns the export's white strokes and fills into the text colour (icons tinted by CSS).
 * Only the project's own asset files go through here, never user content.
 */
export default function InlineSvg({ svg, className, style, motion, currentColor = false, ...rest }) {
  const prefix = useId().replace(/:/g, '')
  const html = useMemo(() => {
    const scoped = scopeSvgIds(svg, prefix)
    return currentColor ? scoped.replace(/(stroke|fill)="white"/g, '$1="currentColor"') : scoped
  }, [svg, prefix, currentColor])
  return <span className={className} style={style} aria-hidden="true" data-svg={motion} dangerouslySetInnerHTML={{ __html: html }} {...rest} />
}
