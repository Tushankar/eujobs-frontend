const ICONS = import.meta.glob('../../assets/icons/nav/*.svg', { query: '?raw', import: 'default', eager: true })
const byName = Object.fromEntries(Object.entries(ICONS).map(([path, svg]) => [path.match(/([\w-]+)\.svg$/)[1], svg]))

/**
 * A Figma "D S › Outlined" vuesax/linear icon (owner 2026-11-13: the dashboards' sidebar icons come from the Figma set),
 * inline so its strokes follow the text colour (active, hover). Files live in assets/icons/nav, named as in Figma.
 */
export default function NavIcon({ name, size = 17, className }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: byName[name].replace('width="24" height="24"', `width="${size}" height="${size}"`) }}
    />
  )
}
