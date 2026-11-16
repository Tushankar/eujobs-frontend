/**
 * Prefixes every id in an inline SVG string (and the url(#…) / href="#…" references to them). Figma exports reuse
 * names such as `clip0_0_4` or `paint0_linear_0_4`, and inline ids are global to the page.
 */
export function scopeSvgIds(svg, prefix) {
  return svg
    .replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`)
}
