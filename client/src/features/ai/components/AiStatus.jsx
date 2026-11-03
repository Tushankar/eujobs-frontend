import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { RotateCcw } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './AiStatus.module.css'

/**
 * The state of one AI text (§2.9, OD13): writing, the daily limit with its reset time, the Plus gate (M-118), or a
 * failure (OpenAI down or timed out) with Try again. Shows `children` once the text is there.
 */
export default function AiStatus({ isLoading, error, onRetry, children }) {
  const { t } = useTranslation('ai')
  const format = useFormat()
  const dispatch = useDispatch()
  if (isLoading) {
    return (
      <p className={styles.state} role="status" data-ai-state="loading">
        {t('status.loading')}
      </p>
    )
  }
  if (!error) return children ?? null
  const code = errorCode(error)
  if (code === 'AI_DAILY_LIMIT') {
    const resetAt = error.data.error.params?.resetAt
    return (
      <p className={styles.limit} role="alert" data-ai-state="limit">
        {t('status.limit', { time: resetAt ? format.dateTime(resetAt) : '' })}
      </p>
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
