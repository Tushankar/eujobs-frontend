import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './MarketplaceHealthCard.module.css'

const KEYS = ['companies', 'coursePurchases', 'checksInReview', 'shortlists', 'outreach', 'pendingReviews', 'activeSubscribers']

/** "Marketplace health" (§3.15, OQ-5): all-time counters with a link into the moderation queue; `loading` keeps the labels over placeholder values. */
export default function MarketplaceHealthCard({ health, loading }) {
  const { t } = useTranslation('adminOverview')
  const format = useFormat()
  return (
    <Panel padding={24} aria-labelledby="marketplace-health-title">
      <SectionTitle id="marketplace-health-title" title={t('health.title')} description={t('health.description')} />
      {loading ? (
        <SkeletonRegion>
          <div className={styles.rows}>
            {KEYS.map((key) => (
              <div key={key} className={styles.row}>
                <span className={styles.label}>{t(`health.${key}`)}</span>
                <div className={styles.value}>
                  <Skeleton width={32} height={14} />
                  {key === 'activeSubscribers' && (
                    <span className={styles.split}>
                      <Skeleton width={120} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SkeletonRegion>
      ) : (
        <dl className={styles.rows}>
          {KEYS.map((key) => (
            <div key={key} className={styles.row} data-health={key}>
              <dt className={styles.label}>{t(`health.${key}`)}</dt>
              {/* P11c-Q20: active subscribers come as { total, candidate, recruiter }, shown with the split by role. */}
              <dd className={styles.value}>
                {health && (key === 'activeSubscribers' ? format.number(health[key].total) : format.number(health[key]))}
                {health && key === 'activeSubscribers' && (
                  <span className={styles.split}>{t('health.byRole', { candidates: format.number(health[key].candidate), recruiters: format.number(health[key].recruiter) })}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Link to="/admin/moderation" className={styles.link}>
        {t('health.moderation')}
        <Icon as={ArrowRight} size={12} />
      </Link>
    </Panel>
  )
}
