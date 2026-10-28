import { cx } from '@/utils/cx.js'
import styles from './RoleLogo.module.css'

/** Company mark for a demo role, drawn from the Figma colours. `picker` uses the picker variant of the colour. */
export default function RoleLogo({ role, size = 36, picker = false }) {
  const { glyph, background, pickerBackground, color, border, serif } = role.logo
  const fill = picker ? (pickerBackground ?? background) : background
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.55),
    background: fill,
    color,
    '--logo-bg': fill,
    '--mark-size': `${Math.round(size * 0.4)}px`,
    ...(border && { border: `2px solid ${border}` }),
  }
  return (
    <span className={cx(styles.logo, serif && styles.serif)} style={style} role="img" aria-label={`${role.company} logo`}>
      {glyph === 'half-circle' ? <span className={styles.mark} /> : glyph}
    </span>
  )
}
