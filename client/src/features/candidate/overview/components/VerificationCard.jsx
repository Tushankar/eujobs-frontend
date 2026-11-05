import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useGetVerificationQuery } from '@/features/candidate/verification/api.js'
import styles from './RailCards.module.css'

/** "Profile verification": the three reviewed checks from the server and "n of N" (M-023, OQ-6f). No premium copy (M-045). */
export default function VerificationCard() {
  const { t } = useTranslation()
  const { data: state, isLoading } = useGetVerificationQuery()
  if (isLoading) return <VerificationCardSkeleton />
  if (!state) return null
  return (
    <section className={styles.card} data-card="verification">
      <VerificationHead />
      <ul className={styles.checks}>
        {state.checks.map((check) => {
          const status = !check.required && check.status === 'not_started' ? 'not_needed' : check.status
          return (
            <li key={check.category} className={styles.checkRow}>
              <span className={styles.checkLabel}>
                <Icon as={CircleCheck} size={14} className={status === 'approved' ? styles.checkDone : styles.checkIdle} />
                {t(`completeness:verification.checks.${check.category}`)}
              </span>
              <span className={styles.muted}>{t(`completeness:verification.status.${status}`)}</span>
            </li>
          )
        })}
      </ul>
      <div className={styles.progressRow}>
        <span className={styles.muted}>{t('completeness:verification.progress')}</span>
        <span className={styles.strong}>{t('completeness:verification.count', { done: state.verifiedCount, total: state.requiredCount })}</span>
      </div>
      {state.verified && (
        <PillBadge tone="success" dot className={styles.locked}>
          {t('completeness:verification.verified')}
        </PillBadge>
      )}
      <Button as={Link} to="/candidate/verification" variant="secondary" fullWidth className={styles.verifyButton} rightIcon={<Icon as={ArrowRight} size={12} />}>
        {t('completeness:verification.button')}
      </Button>
    </section>
  )
}

function VerificationHead() {
  const { t } = useTranslation()
  return (
    <div className={styles.head}>
      <div>
        <h2 className={styles.cardTitle}>{t('completeness:verification.title')}</h2>
        <p className={styles.verifyText}>{t('completeness:verification.lead')}</p>
      </div>
      <span className={styles.roundTile}>
        <Icon as={CircleCheck} size={18} strokeWidth={1.5} />
      </span>
    </div>
  )
}

/** The card while the checks load: the real heading and button, placeholders for the three checks and the count. */
function VerificationCardSkeleton() {
  const { t } = useTranslation()
  return (
    <section className={styles.card}>
      <VerificationHead />
      <SkeletonRegion>
        <ul className={styles.checks}>
          {[110, 96, 124].map((width) => (
            <li key={width} className={styles.checkRow}>
              <span className={styles.checkLabel}>
                <Icon as={CircleCheck} size={14} className={styles.checkIdle} />
                <Skeleton width={width} />
              </span>
              <Skeleton width={56} height={8} />
            </li>
          ))}
        </ul>
        <div className={styles.progressRow}>
          <span className={styles.muted}>{t('completeness:verification.progress')}</span>
          <Skeleton width={40} height={8} />
        </div>
      </SkeletonRegion>
      <Button as={Link} to="/candidate/verification" variant="secondary" fullWidth className={styles.verifyButton} rightIcon={<Icon as={ArrowRight} size={12} />}>
        {t('completeness:verification.button')}
      </Button>
    </section>
  )
}
