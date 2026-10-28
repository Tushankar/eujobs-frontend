import { cx } from '@/utils/cx.js'
import styles from './Panel.module.css'

/**
 * DS Panel shell: bordered white rounded-xl surface, 16/20/24 padding.
 * `selected` applies the blue evidence/AI highlight tint.
 */
export default function Panel({ as: Component = 'section', padding = 20, selected = false, className, children, ...rest }) {
  return (
    <Component
      className={cx(styles.panel, selected && styles.selected, className)}
      style={{ padding }}
      {...rest}
    >
      {children}
    </Component>
  )
}
