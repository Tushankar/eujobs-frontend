import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './CoverNote.module.css'

/** The candidate's cover note on an application, clamped to three lines with a Show more toggle when it is longer. */
export default function CoverNote({ text, labelled = true, className }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || open) return undefined
    const measure = () => setOverflows(node.scrollHeight > node.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [text, open])

  if (!text) return null
  return (
    <div className={cx(styles.note, className)} data-cover-note>
      {labelled && <p className={styles.label}>{t('applications:coverNote.title')}</p>}
      <p ref={ref} className={cx(styles.text, !open && styles.clamped)}>
        {text}
      </p>
      {(overflows || open) && (
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          {t(open ? 'applications:coverNote.less' : 'applications:coverNote.more')}
        </button>
      )}
    </div>
  )
}
