import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './Skeleton.module.css'

/**
 * Grey placeholder for content that is still loading. `shape`: 'text' (a rounded line, the default), 'pill',
 * 'circle' or 'block' (a card-sized area). `width` / `height` take a number (px) or any CSS length. Hidden from
 * assistive tech: wrap the placeholders in a `SkeletonRegion`, which announces the loading once.
 */
export default function Skeleton({ shape = 'text', width, height, className }) {
  return <span aria-hidden="true" className={cx(styles.bone, styles[shape], className)} style={{ width, height }} />
}

/**
 * A loading area: announces "Loading…" to screen readers and marks itself busy. `as` picks the element.
 * The announcement is its first child (a span), so wrap list rows in their own element (never `as="ul"`) and don't
 * rely on `:first-child` among direct children.
 */
export function SkeletonRegion({ as: Tag = 'div', className, children }) {
  const { t } = useTranslation()
  return (
    <Tag className={className} role="status" aria-busy="true" data-skeleton>
      <span className="sr-only">{t('common:loading')}</span>
      {children}
    </Tag>
  )
}
