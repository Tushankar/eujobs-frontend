import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import IconButton from './IconButton.jsx'
import styles from './Modal.module.css'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog with the DS translucent-ink backdrop. Closes on Escape, backdrop click
 * and the close button; traps Tab focus and restores focus to the opener.
 * `divided` switches to the header-rule layout (24px header with a bottom border, 24px body).
 */
export default function Modal({ open, onClose, title, description, children, footer, width = 480, divided = false, className }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const first = dialog?.querySelector('[data-autofocus]') ?? dialog?.querySelector(FOCUSABLE) ?? dialog
    first?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(styles.dialog, divided && styles.divided, className)}
        style={{ maxWidth: width }}
      >
        <header className={styles.header}>
          <div>
            {title && (
              <h2 className={styles.title} id={titleId}>
                {title}
              </h2>
            )}
            {description && (
              <p className={styles.description} id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
