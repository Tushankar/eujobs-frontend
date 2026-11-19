import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './FormAlert.module.css'

const ICONS = { error: CircleAlert, success: CircleCheck, info: Info }

/**
 * A form-level message (wrong credentials, unverified email, rate limit …). `tone` is error, info or success.
 * Redesigned 2026-11-19: a neutral card with a thin tone bar and icon; an optional bold `title` above the message.
 */
export default function FormAlert({ tone = 'error', title, children }) {
  return (
    <div className={cx(styles.alert, styles[tone], title && styles.withTitle)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon as={ICONS[tone] ?? Info} size={16} className={styles.icon} />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children}
      </div>
    </div>
  )
}
