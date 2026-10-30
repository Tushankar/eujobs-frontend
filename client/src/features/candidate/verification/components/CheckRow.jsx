import { useTranslation } from 'react-i18next'
import { BadgeCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './CheckRow.module.css'

const STATUS_TONES = { approved: 'success', in_review: 'warning', rejected: 'danger', not_started: 'neutral', not_needed: 'neutral' }

/**
 * One reviewed check (M-166): copy, its state from the server, the latest submission with a rejection reason,
 * and `action` (the submit button where a new submission is allowed, P3-D8). Self-approval is gone (M-016).
 */
export default function CheckRow({ icon, title, description, accepted, status, latest, note, action }) {
  const { t } = useTranslation()
  const format = useFormat()
  const submittedParams = latest && { date: format.date(latest.submittedAt), file: latest.fileName, type: latest.evidenceType && t(`enums:evidenceType.${latest.evidenceType}`) }
  return (
    <li className={styles.row} data-status={status}>
      <span className={styles.tile}>
        <Icon as={icon} size={18} />
      </span>
      <div className={styles.body}>
        <h3 className={styles.title}>
          {title}
          {status === 'approved' && (
            <span className={styles.tick} role="img" aria-label={t('verification:verified')}>
              <Icon as={BadgeCheck} size={16} />
            </span>
          )}
        </h3>
        {description && <p className={styles.description}>{description}</p>}
        {accepted && <p className={styles.accepted}>{accepted}</p>}
        {note && <p className={styles.accepted}>{note}</p>}
        {latest && <p className={styles.submitted}>{t(latest.evidenceType ? 'verification:submittedType' : 'verification:submitted', submittedParams)}</p>}
        {latest?.status === 'rejected' && latest.reason && <p className={styles.reason}>{t('verification:reason', { reason: latest.reason })}</p>}
      </div>
      <div className={styles.action}>
        <PillBadge tone={STATUS_TONES[status]} dot={status === 'approved'}>
          {t(`completeness:verification.status.${status}`)}
        </PillBadge>
        {action}
      </div>
    </li>
  )
}
