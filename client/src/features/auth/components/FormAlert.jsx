import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { Icon, IconButton } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './FormAlert.module.css'

const ICONS = { error: CircleAlert, success: CircleCheck, info: Info }

/**
 * A form-level message (wrong credentials, unverified email, rate limit …). `tone` is error, info or success.
 * Redesigned 2026-11-19: a neutral card with a thin tone bar and icon; an optional bold `title` above the message.
 * 2026-11-26: `onClose` adds a × (`closeLabel` is its accessible name), e.g. the workspace notice after sign-in.
 */
export default function FormAlert({ tone = 'error', title, onClose, closeLabel, className, children }) {
  return (
    <div className={cx(styles.alert, styles[tone], title && styles.withTitle, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon as={ICONS[tone] ?? Info} size={16} className={styles.icon} />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children}
      </div>
      {onClose && <IconButton icon={X} label={closeLabel} iconSize={16} className={styles.close} onClick={onClose} />}
    </div>
  )
}
