import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Icon } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'

/**
 * M-118, §3.22: the lock chip on a page the user's plan does not include (sidebar and search). It names the role's
 * plan; "Recruiter Plus" is too wide for the sidebar, so a recruiter's chip shows only the lock (the name stays in its
 * tooltip and for screen readers).
 */
export default function PlanChip({ className }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const plan = t(`enums:planKey.${me?.role === 'recruiter' ? 'recruiter_plus' : 'plus'}`)
  const label = t('shell:nav.planLocked', { plan })
  return (
    <span className={className} data-plan-chip title={label}>
      <Icon as={Lock} size={9} aria-hidden="true" />
      {me?.role !== 'recruiter' && <span aria-hidden="true">{plan}</span>}
      <span className="sr-only">{label}</span>
    </span>
  )
}
