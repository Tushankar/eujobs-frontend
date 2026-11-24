import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui'
import styles from './HydrateFallback.module.css'

/**
 * Shown when a route can't load (perf 2026-11-24): GET /me failed with a network or server error (session.js), or a
 * page crashed. A signed-in user stays signed in and can try again instead of landing on sign-in.
 */
export default function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  const code = error?.message === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'INTERNAL_ERROR'
  return (
    <div className={styles.loading} role="alert">
      <div className={styles.error}>
        <p>{t(`errors:${code}`)}</p>
        <Button onClick={() => window.location.reload()}>{t('common:reload')}</Button>
      </div>
    </div>
  )
}
