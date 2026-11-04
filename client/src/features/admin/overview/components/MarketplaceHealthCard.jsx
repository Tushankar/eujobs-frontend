import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './MarketplaceHealthCard.module.css'

const KEYS = ['companies', 'coursePurchases', 'checksInReview', 'shortlists', 'outreach', 'pendingReviews']

/** "Marketplace health" (§3.15, OQ-5): all-time counters with a link into the moderation queue. */
export default function MarketplaceHealthCard({ health }) {
  const { t } = useTranslation('adminOverview')
  const format = useFormat()
  return (
    <Panel padding={24} aria-labelledby="marketplace-health-title">
      <SectionTitle id="marketplace-health-title" title={t('health.title')} description={t('health.description')} />
      <dl className={styles.rows}>
        {KEYS.map((key) => (
          <div key={key} className={styles.row} data-health={key}>
            <dt className={styles.label}>{t(`health.${key}`)}</dt>
            <dd className={styles.value}>{health ? format.number(health[key]) : ''}</dd>
          </div>
        ))}
      </dl>
      <Link to="/admin/moderation" className={styles.link}>
        {t('health.moderation')}
        <Icon as={ArrowRight} size={12} />
      </Link>
    </Panel>
  )
}
