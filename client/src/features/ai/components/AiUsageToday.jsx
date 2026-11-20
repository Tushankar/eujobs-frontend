import { HIRING_ROLES } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetAiUsageQuery } from '../api.js'
import styles from './AiUsageToday.module.css'

/** One limit: its name and reset day and time, the bar, and the share used. */
function LimitRow({ label, used, limit, resetAt, ...rest }) {
  const { t } = useTranslation('ai')
  const format = useFormat()
  const share = limit ? Math.min(1, used / limit) : 0
  return (
    <div className={styles.row} {...rest}>
      <div className={styles.name}>
        <p className={styles.label}>{label}</p>
        <p className={styles.reset}>{t('usage.resets', { time: format.date(resetAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>
      </div>
      <div className={styles.bar} role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={label}>
        <span className={cx(used >= limit && styles.full)} style={{ width: `${Math.max(share * 100, used ? 0 : 1.5)}%` }} />
      </div>
      <p className={styles.percent}>{t('usage.percent', { percent: Math.round(share * 100) })}</p>
    </div>
  )
}

/**
 * Billing's "Your AI usage limits" (owner 2026-11-17), for a candidate or recruiter whose plan includes AI: today's AI
 * uses against the plan's daily cap (it depends on the plan and its billing interval), and each feature with its own
 * daily limit (CV drafts, CV to profile). Every limit starts again at the same time.
 */
export default function AiUsageToday() {
  const { t } = useTranslation('ai')
  const { me } = usePreferences()
  const eligible = ['candidate', ...HIRING_ROLES].includes(me?.role) && me.entitlements?.includes('ai')
  const { data } = useGetAiUsageQuery(undefined, { skip: !eligible, refetchOnMountOrArgChange: true })
  if (!eligible || !data) return null
  // CV features are the candidate's own; a recruiter sees only the daily uses.
  const features = me.role === 'candidate' ? (data.features ?? []) : []
  return (
    <section className={styles.card} aria-labelledby="ai-usage-title" data-ai-usage-today>
      <h3 id="ai-usage-title" className={styles.title}>
        {t('usage.title')}
      </h3>
      <LimitRow label={t('usage.daily')} used={data.used} limit={data.limit} resetAt={data.resetAt} data-ai-limit="daily" />
      {features.map((feature) => (
        <LimitRow key={feature.kind} label={t(`usage.features.${feature.kind}`)} used={feature.used} limit={feature.limit} resetAt={data.resetAt} data-ai-limit={feature.kind} />
      ))}
      <p className={styles.note}>{t('usage.note')}</p>
    </section>
  )
}
