import { useTranslation } from 'react-i18next'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import EmptyState from './EmptyState.jsx'
import styles from './LoadError.module.css'

/**
 * A list that failed to load and has nothing cached (2026-11-24): says so and offers Try again (`onRetry`, usually the
 * query's refetch) instead of an empty page. `retrying` (the query's isFetching) spins the button. `compact` is the
 * small version for dropdowns such as the notification bell.
 */
export default function LoadError({ onRetry, retrying = false, compact = false }) {
  const { t } = useTranslation()
  const retry = (
    <Button variant="outline" size="sm" loading={retrying} leftIcon={<Icon as={RotateCw} size={13} />} onClick={() => onRetry?.()} data-load-retry>
      {t('common:loadError.retry')}
    </Button>
  )
  if (compact) {
    return (
      <div className={styles.compact} role="alert" data-load-error>
        <p className={styles.text}>{t('common:loadError.title')}</p>
        {retry}
      </div>
    )
  }
  return (
    <div role="alert" data-load-error>
      <EmptyState icon={TriangleAlert} title={t('common:loadError.title')} description={t('common:loadError.text')} action={retry} />
    </div>
  )
}
