import { BRAND } from '@/app/brand.js'
import logo from '@/assets/images/logo.png'
import styles from './BrandLogo.module.css'

/** The EU JOBS logo from Figma (node 426:64), name and tagline included in the image. `height` in px. */
export default function BrandLogo({ height = 45 }) {
  return <img src={logo} alt={`${BRAND.name} · ${BRAND.tagline}`} className={styles.logo} style={{ height }} />
}
