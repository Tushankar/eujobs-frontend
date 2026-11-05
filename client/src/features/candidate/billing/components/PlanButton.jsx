import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Lock } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'
import { lacksEntitlement } from '../usePlan.js'

/**
 * A paid action (M-118, §3.22, P11c-Q5): for a user of `roles` without the entitlement it keeps its label, shows a lock
 * and opens the upgrade dialog without sending the request; everyone else gets the action. `when` = false skips the
 * lock (e.g. Publish while no other job is live); `lockedProps` are added to the locked button only (a test marker).
 */
export default function PlanButton({ entitlement, roles = ['candidate'], when = true, onClick, leftIcon, lockedProps, children, ...props }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const dispatch = useDispatch()
  if (when && lacksEntitlement(me, entitlement, roles)) {
    return (
      <Button {...props} {...lockedProps} leftIcon={<Icon as={Lock} size={13} />} onClick={() => dispatch(openUpgrade(entitlement))} data-plan-locked={entitlement}>
        {children}
        <span className="sr-only"> · {t(`enums:planKey.${me.role === 'recruiter' ? 'recruiter_plus' : 'plus'}`)}</span>
      </Button>
    )
  }
  return (
    <Button {...props} leftIcon={leftIcon} onClick={onClick}>
      {children}
    </Button>
  )
}
