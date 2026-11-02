import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './CompanyLogo.module.css'

const PALETTES = ['green', 'orange', 'violet', 'blue']

/** M-150: the letter tile's colour comes from the company id, so it stays the same everywhere and after reloads. */
function paletteFor(seed) {
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0)
  return PALETTES[sum % PALETTES.length]
}

/** DS Company logo: the uploaded logo, else a compact rounded-square tile with the initials. `id` seeds the colour. */
export default function CompanyLogo({ name, id, src, size = 40, className }) {
  const { t } = useTranslation()
  const style = { width: size, height: size, fontSize: Math.round(size * 0.32) }
  const label = t('common:companyLogo', { name })
  if (src) {
    return <img src={src} alt={label} className={cx(styles.logo, styles.image, className)} style={style} />
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
  return (
    <span className={cx(styles.logo, styles[paletteFor(id ?? name)], className)} style={style} role="img" aria-label={label}>
      {initials}
    </span>
  )
}
