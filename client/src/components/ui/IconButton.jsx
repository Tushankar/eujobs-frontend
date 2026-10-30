import { cx } from '@/utils/cx.js'
import Icon from './Icon.jsx'
import styles from './IconButton.module.css'

/**
 * DS IconButton: 36px square, 12px radius. `label` is the accessible name
 * (a tooltip is not a substitute), so it is required.
 */
export default function IconButton({
  as: Component = 'button',
  icon,
  label,
  iconSize = 17,
  className,
  type,
  ...rest
}) {
  const nativeProps = Component === 'button' ? { type: type ?? 'button' } : {}
  return (
    <Component className={cx(styles.iconButton, className)} aria-label={label} title={label} {...nativeProps} {...rest}>
      <Icon as={icon} size={iconSize} />
    </Component>
  )
}
