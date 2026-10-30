import { cx } from '@/utils/cx.js'
import styles from './JobLogo.module.css'

/** Company tile from the Figma job cards: a glyph on a coloured rounded square (optional outline / serif face). */
export default function JobLogo({ company, logo, size = 44, className }) {
  const style = {
    width: size,
    height: size,
    background: logo.bg,
    color: logo.color,
    fontSize: Math.round(size * 0.545),
    lineHeight: `${Math.round(size * 0.727)}px`,
    border: logo.border ? `2px solid ${logo.border}` : undefined,
  }
  return (
    <span className={cx(styles.logo, logo.serif && styles.serif, className)} style={style} role="img" aria-label={`${company} logo`}>
      {logo.glyph}
    </span>
  )
}
