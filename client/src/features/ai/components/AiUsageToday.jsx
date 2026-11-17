import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetAiUsageQuery } from '../api.js'
import styles from './AiUsageToday.module.css'

/**
 * Billing's "AI uses today" (owner 2026-11-17): how many of the plan's daily AI uses are spent and when they reset,
 * for a candidate or recruiter whose plan includes AI. The cap depends on the plan and its billing interval.
 */
export default function AiUsageToday() {
  const { t } = useTranslation('ai')
  const format = useFormat()
  const { me } = usePreferences()
  const eligible = ['candidate', 'recruiter'].includes(me?.role) && me.entitlements?.includes('ai')
  const { data } = useGetAiUsageQuery(undefined, { skip: !eligible, refetchOnMountOrArgChange: true })
  if (!eligible || !data) return null
  const share = data.limit ? Math.min(1, data.used / data.limit) : 0
  return (
    <section className={styles.card} data-ai-usage-today>
      <div className={styles.head}>
        <h3 className={styles.title}>
          <Icon as={Sparkles} size={15} /> {t('usage.title')}
        </h3>
        <p className={styles.count}>{t('usage.count', { used: format.number(data.used), limit: format.number(data.limit) })}</p>
      </div>
      <div className={styles.bar} role="meter" aria-valuemin={0} aria-valuemax={data.limit} aria-valuenow={data.used} aria-label={t('usage.title')}>
        <span className={data.remaining === 0 ? styles.full : undefined} style={{ width: `${share * 100}%` }} />
      </div>
      <p className={styles.note}>{t('usage.note', { remaining: format.number(data.remaining), time: format.dateTime(data.resetAt) })}</p>
    </section>
  )
}
