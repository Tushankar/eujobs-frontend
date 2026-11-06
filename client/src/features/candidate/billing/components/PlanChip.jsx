import { useTranslation } from 'react-i18next'
import { Crown } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Icon } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'
import styles from './PlanChip.module.css'

/**
 * M-118, §3.22: the mark on a page the user's plan does not include (sidebar and search): the paid badge's gold crown,
 * no text. The plan's name ("Part of Plus") is in its tooltip and for screen readers.
 */
export default function PlanChip({ className }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const plan = t(`enums:planKey.${me?.role === 'recruiter' ? 'recruiter_plus' : 'plus'}`)
  const label = t('shell:nav.planLocked', { plan })
  return (
    <span className={cx(styles.chip, className)} data-plan-chip title={label}>
      <Icon as={Crown} size={14} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
