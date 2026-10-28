import { LoaderCircle } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import Icon from './Icon.jsx'
import styles from './Button.module.css'

/**
 * DS Button: primary | secondary | outline | ghost | danger, 40px min height, 12px / 600 label.
 * Renders a native <button> by default; pass `as={Link}` (react-router) for navigation.
 * A loading button is disabled and announces progress via aria-busy.
 */
export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  children,
  type,
  disabled,
  ...rest
}) {
  const isNativeButton = Component === 'button'
  const nativeProps = isNativeButton
    ? { type: type ?? 'button', disabled: disabled || loading }
    : { 'aria-disabled': disabled || loading || undefined }

  return (
    <Component
      className={cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className)}
      aria-busy={loading || undefined}
      {...nativeProps}
      {...rest}
    >
      {loading ? <Icon as={LoaderCircle} size={14} className={styles.spinner} /> : leftIcon}
      {children}
      {!loading && rightIcon && <span className={styles.trailing}>{rightIcon}</span>}
    </Component>
  )
}
