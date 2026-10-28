import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './EmptyState.module.css'

/** Centred "nothing here" message with an optional icon and action. `size="lg"` is the solid-bordered, roomier variant. */
export default function EmptyState({ icon, title, description, action, size = 'md' }) {
  return (
    <div className={cx(styles.root, size === 'lg' && styles.large)}>
      {icon && (
        <span className={styles.icon}>
          <Icon as={icon} size={20} />
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
