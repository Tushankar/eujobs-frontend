/**
 * Renders a lucide-react icon with the stroke weight used by the Figma icons
 * (1.7 on the 24px grid — e.g. 1.4167 at 20px). Icons are decorative unless
 * the surrounding control carries an accessible name.
 *
 *   <Icon as={Search} size={16} />
 */
export default function Icon({ as: Glyph, size = 16, strokeWidth = 1.7, ...rest }) {
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />
}
