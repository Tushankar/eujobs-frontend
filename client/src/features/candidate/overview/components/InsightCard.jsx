import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'
import { Icon, IconButton, Skeleton, SkeletonRegion } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import { useGetInsightsOverviewQuery } from '@/features/ai/api.js'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'
import styles from './RailCards.module.css'

/**
 * The AI insights teaser (back with Phase 9, P4-Q1) for Plus: the profile skill most open roles of the market list
 * (M-066, computed, no AI call). Dismissing it is the one Overview choice kept in the browser (§2.15).
 */
export default function InsightCard() {
  const { t } = useTranslation('aiInsights')
  const { me } = usePreferences()
  const locked = lacksEntitlement(me, 'ai')
  const [dismissed, setDismissed] = useLocalStorage('lwm.candidate.overview.insightDismissed', false)
  const { data, isLoading } = useGetInsightsOverviewQuery(undefined, { skip: locked || dismissed })
  const [top] = data?.skillDemand ?? []
  if (isLoading) {
    return (
      <section className={styles.insight}>
        <div className={styles.insightHead}>
          <span className={styles.insightLabel}>
            <img src={aiGlyph} alt="" width={16} height={16} />
            {t('teaser.label')}
          </span>
        </div>
        <SkeletonRegion>
          <p className={styles.insightTitle}>
            <Skeleton width="85%" height={14} />
          </p>
          <p className={styles.insightText}>
            <Skeleton />
            <Skeleton width="70%" />
          </p>
          <p className={styles.insightLink}>
            <Skeleton width={90} />
          </p>
        </SkeletonRegion>
      </section>
    )
  }
  if (locked || dismissed || !top?.jobCount) return null

  return (
    <section className={styles.insight} data-insight-card>
      <div className={styles.insightHead}>
        <span className={styles.insightLabel}>
          <img src={aiGlyph} alt="" width={16} height={16} />
          {t('teaser.label')}
        </span>
        <IconButton icon={X} label={t('teaser.dismiss')} className={styles.dismiss} onClick={() => setDismissed(true)} />
      </div>
      <h2 className={styles.insightTitle}>{t('teaser.title', { skill: top.skill })}</h2>
      <p className={styles.insightText}>{t('teaser.text', { count: top.jobCount, total: data.stats.jobsConsidered })}</p>
      <Link to="/candidate/ai-insights" className={styles.insightLink}>
        {t('teaser.link')}
        <Icon as={ArrowRight} size={12} />
      </Link>
    </section>
  )
}
