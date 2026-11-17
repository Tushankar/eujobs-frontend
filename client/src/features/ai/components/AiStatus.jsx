import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { RotateCcw } from 'lucide-react'
import { api, errorCode } from '@/app/api.js'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './AiStatus.module.css'

/**
 * The state of one AI text (§2.9, OD13): writing, the daily limit with its reset time, the Plus gate (M-118), a pause
 * (the admin's budget, 2026-11-17), too many requests in a minute, or a failure (OpenAI down or timed out) with Try
 * again. Shows `children` once the text is there, and then refreshes the "uses left" count.
 */
export default function AiStatus({ isLoading, error, onRetry, children }) {
  const { t } = useTranslation('ai')
  const format = useFormat()
  const dispatch = useDispatch()
  const done = Boolean(!isLoading && !error && children)
  useEffect(() => {
    if (done) dispatch(api.util.invalidateTags(['AiUsage']))
  }, [done, dispatch])
  if (isLoading) {
    return (
      <p className={styles.state} role="status" data-ai-state="loading">
        {t('status.loading')}
      </p>
    )
  }
  if (!error) return children ?? null
  const code = errorCode(error)
  const params = error.data?.error?.params ?? {}
  if (code === 'AI_DAILY_LIMIT') {
    return (
      <p className={styles.limit} role="alert" data-ai-state="limit">
        {t('status.limit', { count: params.limit, time: params.resetAt ? format.dateTime(params.resetAt) : '' })}
      </p>
    )
  }
  if (code === 'AI_PAUSED') {
    return (
      <p className={styles.limit} role="alert" data-ai-state="paused">
        {t('status.paused', { time: params.resetAt ? format.date(params.resetAt) : '' })}
      </p>
    )
  }
  if (code === 'RATE_LIMITED') {
    return (
      <div className={styles.limit} role="alert" data-ai-state="busy">
        <p>{t('status.busy', { count: params.retryAfter ?? 60 })}</p>
        {onRetry && (
          <Button variant="outline" size="sm" leftIcon={<Icon as={RotateCcw} size={13} />} onClick={onRetry}>
            {t('status.retry')}
          </Button>
        )}
      </div>
    )
  }
  if (code === 'PLAN_REQUIRED') {
    return (
      <div className={styles.error} data-ai-state="plan">
        <p>{t('status.plan')}</p>
        <Button variant="outline" size="sm" onClick={() => dispatch(openUpgrade('ai'))}>
          {t('status.upgrade')}
        </Button>
      </div>
    )
  }
  return (
    <div className={styles.error} role="alert" data-ai-state="error">
      <p>{t(code === 'NOT_FOUND' ? 'status.notFound' : 'status.unavailable')}</p>
      {onRetry && code !== 'NOT_FOUND' && (
        <Button variant="outline" size="sm" leftIcon={<Icon as={RotateCcw} size={13} />} onClick={onRetry}>
          {t('status.retry')}
        </Button>
      )}
    </div>
  )
}
