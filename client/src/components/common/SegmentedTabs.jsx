import { useRef } from 'react'
import { useActiveIndicator } from '@/hooks/useActiveIndicator.js'
import { cx } from '@/utils/cx.js'
import styles from './TabBar.module.css'

/**
 * Underline tab switcher. `tabs` = [{ id, label, iconSrc? }].
 * Selection is controlled; the panel it drives is rendered by the caller. The underline slides between tabs.
 */
export default function SegmentedTabs({ tabs, value, onChange, label, className }) {
  const trayRef = useRef(null)
  useActiveIndicator(trayRef, value)

  return (
    <div className={cx(styles.bar, className)} role="tablist" aria-label={label} ref={trayRef}>
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(tab.id)}
          >
            {tab.iconSrc && <img src={tab.iconSrc} alt="" width={14} height={14} />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
