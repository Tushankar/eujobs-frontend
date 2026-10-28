import { useId } from 'react'
import { Check } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import Icon from './Icon.jsx'
import styles from './Checkbox.module.css'

/** Native checkbox with a DS-styled box. Children are the visible label. */
export default function Checkbox({ children, className, id, ...inputProps }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <label className={cx(styles.checkbox, className)} htmlFor={inputId}>
      <input id={inputId} type="checkbox" className={styles.input} {...inputProps} />
      <span className={styles.box} aria-hidden="true">
        <Icon as={Check} size={12} strokeWidth={2.4} className={styles.tick} />
      </span>
      {children && <span className={styles.text}>{children}</span>}
    </label>
  )
}
