import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Icon } from '@/components/ui'

/** M-118: the lock chip on a page the candidate's plan does not include (sidebar and search). */
export default function PlanChip({ className }) {
  const { t } = useTranslation()
  const plan = t('enums:planKey.plus')
  const label = t('shell:nav.planLocked', { plan })
  return (
    <span className={className} data-plan-chip title={label}>
      <Icon as={Lock} size={9} aria-hidden="true" />
      <span aria-hidden="true">{plan}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
