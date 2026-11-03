import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Lock } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon } from '@/components/ui'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'

/**
 * An AI action (M-118): for a candidate without Plus it stays visible with a lock and opens the upgrade dialog, so a
 * Free candidate never meets a button that fails; everyone else gets the action.
 */
export default function AiButton({ onClick, leftIcon, children, ...props }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const dispatch = useDispatch()
  if (lacksEntitlement(me, 'ai')) {
    return (
      <Button {...props} leftIcon={<Icon as={Lock} size={13} />} onClick={() => dispatch(openUpgrade('ai'))} data-ai-locked>
        {children}
        <span className="sr-only"> · {t('enums:planKey.plus')}</span>
      </Button>
    )
  }
  return (
    <Button {...props} leftIcon={leftIcon} onClick={onClick}>
      {children}
    </Button>
  )
}
