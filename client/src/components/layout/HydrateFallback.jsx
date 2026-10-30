import { useTranslation } from 'react-i18next'
import styles from './HydrateFallback.module.css'

/** Shown while the first route's loader runs (GET /me). */
export default function HydrateFallback() {
  const { t } = useTranslation()
  return (
    <p className={styles.loading} role="status">
      {t('common:loading')}
    </p>
  )
}
