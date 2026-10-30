import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './CompletenessChecklist.module.css'

/**
 * The server's checklist (§3.2, M-015): "x of N", a meter and every item; open items link to where they are
 * done. `items` limits the list (the Overview shows only the next open items).
 */
export default function CompletenessChecklist({ completeness, items = completeness.items, heading }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { done, total, percent, complete } = completeness
  return (
    <div className={styles.checklist}>
      <div className={styles.head}>
        {heading}
        {complete ? (
          <PillBadge tone="success" dot>
            {t('completeness:complete')}
          </PillBadge>
        ) : (
          <span className={styles.count}>{t('completeness:progress', { done, total })}</span>
        )}
      </div>
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
          <li key={item.key} className={styles.item} data-item={item.key} data-done={item.done}>
            {item.done ? <Icon as={CircleCheck} size={14} className={styles.done} /> : <span className={styles.open} aria-hidden="true" />}
            {item.done ? <span>{t(`completeness:items.${item.key}`)}</span> : <Link to={item.route}>{t(`completeness:items.${item.key}`)}</Link>}
          </li>
        ))}
      </ul>
    </div>
  )
}
