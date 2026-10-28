import { cx } from '@/utils/cx.js'
import styles from './CompanyLogo.module.css'

const PALETTES = ['green', 'orange', 'violet', 'blue']

function paletteFor(name) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  return PALETTES[sum % PALETTES.length]
}

/** DS Company logo: compact rounded-square initials. Pass `src` when a source logo exists. */
export default function CompanyLogo({ name, src, size = 40, className }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.32) }
  if (src) {
    return <img src={src} alt={`${name} logo`} className={cx(styles.logo, className)} style={style} />
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
  return (
    <span className={cx(styles.logo, styles[paletteFor(name)], className)} style={style} role="img" aria-label={`${name} logo`}>
      {initials}
    </span>
  )
}
