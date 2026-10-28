import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { usePresence } from '@/hooks/usePresence.js'
import { cx } from '@/utils/cx.js'
import IconButton from './IconButton.jsx'
import styles from './Modal.module.css'

// Keep in sync with the exit animation in Modal.module.css.
const EXIT_MS = 180

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
  const { mounted, closing } = usePresence(open, EXIT_MS)

  // Callers usually clear the data behind a dialog (the selected item, its title) as they close it, so the
  // exit animation keeps showing what the dialog last had instead of collapsing to an empty shell.
  const latest = useRef(null)
  const live = { title, description, children, footer }
  if (open) latest.current = live
  const shown = open ? live : (latest.current ?? live)

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

  if (!mounted) return null

  return createPortal(
    <div
      className={cx(styles.backdrop, closing && styles.closing)}
      inert={closing}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={shown.title ? titleId : undefined}
        aria-describedby={shown.description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(styles.dialog, divided && styles.divided, className)}
        style={{ maxWidth: width }}
      >
        <header className={styles.header}>
          <div>
            {shown.title && (
              <h2 className={styles.title} id={titleId}>
                {shown.title}
              </h2>
            )}
            {shown.description && (
              <p className={styles.description} id={descriptionId}>
                {shown.description}
              </p>
            )}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        <div className={styles.body}>{shown.children}</div>
        {shown.footer && <footer className={styles.footer}>{shown.footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
