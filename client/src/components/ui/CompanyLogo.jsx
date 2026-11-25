import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './CompanyLogo.module.css'

const PALETTES = ['green', 'orange', 'violet', 'blue']

/** M-150: the letter tile's colour comes from the company id, so it stays the same everywhere and after reloads. */
function paletteFor(seed) {
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0)
  return PALETTES[sum % PALETTES.length]
}

/**
 * DS Company logo: the uploaded logo, else a tile with the initials. `id` seeds the colour.
 * 2026-11-25 (owner: "logos everywhere circular, properly aligned"): always a circle. A square or round logo fills it
 * edge to edge, like the header avatar; a wide or tall wordmark sits whole on white with an inner margin instead of
 * being cut at the edges (its shape is read from the image once it loads).
 */
export default function CompanyLogo({ name, id, src, size = 40, className }) {
  const { t } = useTranslation()
  // A logo that fails to load (an expired signed URL, a missing file) shows the initials, like Avatar.
  const [failedSrc, setFailedSrc] = useState(null)
  const [wordmark, setWordmark] = useState(null)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.32) }
  const label = t('common:companyLogo', { name })
  if (src && src !== failedSrc) {
    const fit = wordmark === src
    return (
      <img
        src={src}
        alt={label}
        className={cx(styles.logo, styles.image, fit && styles.wordmark, className)}
        style={fit ? { ...style, padding: Math.max(3, Math.round(size * 0.12)) } : style}
        onLoad={(event) => {
          const ratio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight
          setWordmark(ratio > 1.2 || ratio < 0.83 ? src : null)
        }}
        onError={() => setFailedSrc(src)}
      />
    )
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
