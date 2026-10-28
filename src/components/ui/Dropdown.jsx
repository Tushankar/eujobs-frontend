import { useEffect, useRef, useState } from 'react'
import { usePresence } from '@/hooks/usePresence.js'
import { cx } from '@/utils/cx.js'
import styles from './Dropdown.module.css'

// Keep in sync with the exit animation in Dropdown.module.css.
const EXIT_MS = 140

/**
 * Popover anchored to a trigger. Closes on outside click and Escape.
 *
 *   <Dropdown trigger={(props) => <button {...props}>Open</button>}>
 *     {({ close }) => <button onClick={close}>Item</button>}
 *   </Dropdown>
 *
 * `props` carries onClick + aria-expanded/aria-haspopup for the trigger.
 */
export default function Dropdown({ trigger, children, align = 'end', className, panelClassName }) {
  const [open, setOpen] = useState(false)
  const { mounted, closing } = usePresence(open, EXIT_MS)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div className={cx(styles.root, className)} ref={rootRef}>
      {trigger({
        onClick: () => setOpen((current) => !current),
        'aria-expanded': open,
        'aria-haspopup': 'true',
      })}
      {mounted && (
        <div
          className={cx(styles.panel, align === 'start' ? styles.start : styles.end, closing && styles.closing, panelClassName)}
          inert={closing}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  )
}
