import { cx } from '@/utils/cx.js'
import styles from './FormAlert.module.css'

/** A form-level message (wrong credentials, unverified email, rate limit …). `tone` is error, info or success. */
export default function FormAlert({ tone = 'error', children }) {
  return (
    <div className={cx(styles.alert, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
