import { HIRING_ROLES } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetAiUsageQuery } from '../api.js'
import styles from './AiStatus.module.css'

/**
 * "37 of 40 AI uses left today" (owner 2026-11-17) for a candidate or recruiter whose plan includes AI. The cap
 * depends on the plan and its billing interval; AiStatus refreshes the count after each new text.
 */
export default function AiUsesLeft({ className }) {
  const { t } = useTranslation('ai')
  const { me } = usePreferences()
  const eligible = ['candidate', ...HIRING_ROLES].includes(me?.role) && me.entitlements?.includes('ai')
  const { data } = useGetAiUsageQuery(undefined, { skip: !eligible })
  if (!eligible || !data) return null
  return (
    <p className={cx(styles.usesLeft, data.remaining === 0 && styles.usesNone, className)} data-ai-uses-left>
      {t('status.usesLeft', { remaining: data.remaining, limit: data.limit })}
    </p>
  )
}
