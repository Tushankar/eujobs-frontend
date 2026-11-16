import { useId, useMemo } from 'react'
import { BRAND } from '@/app/brand.js'
import logoUrl from '@/assets/images/logo.svg'
import logoSvg from '@/assets/images/logo.svg?raw'
import { scopeSvgIds } from '@/lib/svg.js'
import { cx } from '@/utils/cx.js'
import styles from './BrandLogo.module.css'

/* The logo's 29 shapes in file order, named so the intro can move each part: [part, count]. */
const PARTS = [['tagline', 16], ['rule-l', 1], ['rule-r', 1], ['bar', 3], ['jobs', 4], ['divider', 1], ['swoosh', 1], ['u', 2]]
const TAGS = PARTS.flatMap(([part, count]) => Array.from({ length: count }, (_, i) => `data-part="${part}" style="--i:${i}"`))

/**
 * The EU JOBS logo from Figma (node 484:7863), name and tagline included, inline so its parts can animate. `height` in
 * px. `motion`: "intro" builds the logo in on mount (public pages; remount it to replay) and shines on hover, "shine"
 * only sweeps a light across it on hover (app shell); both stay still under reduced motion.
 */
export default function BrandLogo({ height = 45, motion }) {
  const prefix = useId().replace(/:/g, '')
  const html = useMemo(() => {
    let index = 0
    return scopeSvgIds(logoSvg, prefix).replace(/<path /g, () => `<path ${TAGS[index++]} `)
  }, [prefix])
  return (
    <span
      role="img"
      aria-label={`${BRAND.name} · ${BRAND.tagline}`}
      className={cx(styles.logo, motion && styles[motion])}
      style={{ height, '--logo-mask': `url("${logoUrl}")` }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
