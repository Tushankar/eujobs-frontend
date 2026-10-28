import { cx } from '@/utils/cx.js'
import styles from './Avatar.module.css'

const PALETTES = ['peach', 'mint', 'lilac', 'sky']

function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function paletteFor(name) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  return PALETTES[sum % PALETTES.length]
}

/**
 * DS Avatar: rounded-full initials chip. Pass `src` to show a supplied
 * illustration/photo instead (alt is then the person's name). `colors` = { bg, fg } overrides the
 * name-derived palette (used where the data carries the Figma chip colours).
 */
export default function Avatar({ name, src, size = 40, colors, className }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.32) }
  if (src) {
    return <img src={src} alt={name} className={cx(styles.avatar, className)} style={style} />
  }
  return (
    <span
      className={cx(styles.avatar, !colors && styles[paletteFor(name)], className)}
      style={colors ? { ...style, background: colors.bg, color: colors.fg } : style}
      role="img"
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  )
}
