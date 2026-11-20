import { HIRING_ROLES } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/lib/preferences.js'
import { useGetAiUsageQuery } from '../api.js'
import styles from './AiStatus.module.css'

/**
 * "Uses 5 AI credits" beside an expensive AI action (owner 2026-11-17), from the admin's credit costs; nothing for a
 * kind that takes one credit, or for someone whose plan has no AI.
 */
export default function CreditCost({ kind }) {
  const { t } = useTranslation('ai')
  const { me } = usePreferences()
  const eligible = ['candidate', ...HIRING_ROLES].includes(me?.role) && me.entitlements?.includes('ai')
  const { data } = useGetAiUsageQuery(undefined, { skip: !eligible })
  const cost = data?.costs?.[kind] ?? 1
  if (!eligible || cost <= 1) return null
  return (
    <span className={styles.usesLeft} data-credit-cost={kind}>
      {t('credits.cost', { count: cost })}
    </span>
  )
}
