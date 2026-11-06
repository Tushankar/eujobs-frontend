import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { completenessIcon } from '../utils/completenessIcons.js'
import styles from './CompletenessChecklist.module.css'

/**
 * The server's checklist (§3.2, M-015): "x of N", a meter and every item; open items link to where they are
 * done. `items` limits the list (the Overview shows only the next open items). `limit` folds it to the first
 * `limit` open items with "Show all" (My profile, so the cards under it stay on screen); folded rows stay in the
 * page, hidden.
 */
export default function CompletenessChecklist({ completeness, items = completeness.items, heading, onOpen, limit }) {
  const { t } = useTranslation()
  const format = useFormat()
  const [expanded, setExpanded] = useState(false)
  const { done, total, percent, complete } = completeness
  const shown = new Set(limit && !expanded ? items.filter((item) => !item.done).slice(0, limit).map((item) => item.key) : items.map((item) => item.key))
  const foldable = Boolean(limit) && !complete && (expanded || shown.size < items.length)
  return (
    <div className={styles.checklist}>
      <div className={styles.head}>
        {heading}
        {complete ? (
          <PillBadge tone="success" dot>
            {t('completeness:complete')}
          </PillBadge>
        ) : (
          <span className={styles.percent}>{format.number(percent / 100, { style: 'percent' })}</span>
        )}
      </div>
      {!complete && <p className={styles.count}>{t('completeness:progress', { done, total })}</p>}
      <div
        className={styles.meter}
        role="progressbar"
        aria-label={t('completeness:title')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={format.number(percent / 100, { style: 'percent' })}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.key} data-item={item.key} data-done={item.done} hidden={!shown.has(item.key)}>
            {item.done ? (
              <span className={cx(styles.item, styles.itemDone)}>
                <span className={styles.doneIcon}>
                  <Icon as={Check} size={12} strokeWidth={2.5} />
                </span>
                <span className={styles.label}>{t(`completeness:items.${item.key}`)}</span>
              </span>
            ) : (
              (() => {
                const content = (
                  <>
                    <span className={styles.openIcon}>
                      <Icon as={completenessIcon(item.key)} size={14} />
                    </span>
                    <span className={styles.label}>{t(`completeness:items.${item.key}`)}</span>
                    <Icon as={ChevronRight} size={14} className={styles.chevron} />
                  </>
                )
                // On My profile an item opens its editor in place; elsewhere it links to the page that does it.
                return onOpen?.[item.key] ? (
                  <button type="button" className={cx(styles.item, styles.link)} onClick={onOpen[item.key]}>
                    {content}
                  </button>
                ) : (
                  <Link to={item.route} className={cx(styles.item, styles.link)}>
                    {content}
                  </Link>
                )
              })()
            )}
          </li>
        ))}
      </ul>
      {foldable && (
        <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? t('completeness:showLess') : t('completeness:showAll', { total: items.length })}
          <Icon as={ChevronDown} size={14} className={cx(expanded && styles.flipped)} />
        </button>
      )}
    </div>
  )
}
