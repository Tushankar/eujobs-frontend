import { BRAND } from '@/app/brand.js'
import mark from '@/assets/images/logo-mark.png'
import styles from './BrandLogo.module.css'

/** OD11: the "AI" mark cropped from the original logo, with the name and tagline as live Manrope text. `height` in px. */
export default function BrandLogo({ height = 45 }) {
  return (
    <span className={styles.logo} style={{ '--logo-height': `${height}px` }}>
      <img src={mark} alt="" className={styles.mark} />
      <span className={styles.text}>
        <span className={styles.name}>{BRAND.name}</span>
        <span className={styles.tagline}>{BRAND.tagline}</span>
      </span>
    </span>
  )
}
