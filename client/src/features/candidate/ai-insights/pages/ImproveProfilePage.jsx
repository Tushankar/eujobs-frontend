import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import sparkle from '@/assets/icons/ai-insights-sparkle-12.svg'
import { useGetInsightNarrativeQuery, useGetInsightPageQuery, useRemovePlanSkillMutation } from '@/features/ai/api.js'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { useFormat } from '@/lib/preferences.js'
import AiPageShell from '../components/AiPageShell.jsx'
import LearningPlanCard from '../components/LearningPlanCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import styles from './ImproveProfilePage.module.css'

/**
 * Improve profile (§3.2, M-057): the profile checklist with each area's state; OpenAI adds one hint per area. Each card
 * opens the profile area; nothing changes here.
 */
export default function ImproveProfilePage() {
  const { t } = useTranslation('aiInsights')
  const format = useFormat()
  const { data, isLoading } = useGetInsightPageQuery({ page: 'improve-profile' })
  const narrative = useGetInsightNarrativeQuery({ section: 'improve' })
  const [removePlan] = useRemovePlanSkillMutation()
  const completeness = data?.completeness
  const hint = (key) => narrative.data?.suggestions.find((item) => item.area === key)?.text

  return (
    <AiPageShell eyebrow={t('improve.eyebrow')} title={t('improve.title')} description={t('improve.description')}>
      {isLoading && <ImproveSkeleton />}
      {completeness && (
        <>
          <Panel className={styles.hero} padding={32}>
            <div className={styles.heroText}>
              <div className={styles.badgeRow}>
                <PillBadge tone="primary">
                  <img src={sparkle} alt="" width={12} height={12} />
                  {t('improve.badge')}
                </PillBadge>
              </div>
              <h2 className={styles.heroTitle}>{t('improve.heroTitle')}</h2>
              <p className={styles.heroCopy}>{t('improve.heroCopy')}</p>
            </div>
            <div className={styles.completeness}>
              <p className={styles.completenessLabel}>{t('improve.completeness')}</p>
              <p className={styles.percent}>{format.number(completeness.done / completeness.total, { style: 'percent' })}</p>
              <div
                className={styles.bar}
                role="progressbar"
                aria-label={t('improve.completeness')}
                aria-valuemin={0}
                aria-valuemax={completeness.total}
                aria-valuenow={completeness.done}
              >
                <span className={styles.fill} style={{ width: `${(completeness.done / completeness.total) * 100}%` }} />
              </div>
              <p className={styles.completenessLabel}>{t('improve.areas', { done: completeness.done, total: completeness.total })}</p>
            </div>
          </Panel>

          <SectionHeading className={styles.heading} title={t('improve.heading')} description={t('improve.headingLead')} />
          <div data-narrative="improve">
            <AiStatus error={narrative.error} onRetry={narrative.refetch} />
          </div>
          <ul className={styles.grid}>
            {completeness.items.map((item) => (
              <li key={item.key} data-area={item.key}>
                <Panel as="article" padding={24} className={styles.card}>
                  <div className={styles.cardHead}>
                    {item.done ? (
                      <PillBadge tone="success">
                        <Icon as={Check} size={11} strokeWidth={2} />
                        {t('improve.done')}
                      </PillBadge>
                    ) : (
                      <PillBadge tone="warning">{t('improve.todo')}</PillBadge>
                    )}
                  </div>
                  <h3 className={styles.cardTitle}>{t(`completeness:items.${item.key}`)}</h3>
                  {narrative.isFetching ? (
                    <SkeletonRegion className={styles.cardSkeleton}>
                      <Skeleton />
                      <Skeleton width="70%" />
                    </SkeletonRegion>
                  ) : (
                    hint(item.key) && <p className={styles.cardText}>{hint(item.key)}</p>
                  )}
                  <Button
                    as={Link}
                    to={item.route}
                    variant={item.done ? 'outline' : 'primary'}
                    className={styles.cardAction}
                    rightIcon={<Icon as={ArrowRight} size={13} strokeWidth={2} />}
                  >
                    {t('improve.open')}
                  </Button>
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.plan}>
        <LearningPlanCard loading={isLoading} plan={data?.learningPlan ?? []} onRemove={(skill) => removePlan(skill)} exploreLabel={t('plan.exploreGaps')} exploreTo="/candidate/ai-insights/skill-gap" />
      </div>
    </AiPageShell>
  )
}

/** The hero and area cards while the checklist loads: the real copy, placeholders for the share and the areas. */
function ImproveSkeleton() {
  const { t } = useTranslation('aiInsights')
  return (
    <>
      <Panel className={styles.hero} padding={32}>
        <div className={styles.heroText}>
          <div className={styles.badgeRow}>
            <PillBadge tone="primary">
              <img src={sparkle} alt="" width={12} height={12} />
              {t('improve.badge')}
            </PillBadge>
          </div>
          <h2 className={styles.heroTitle}>{t('improve.heroTitle')}</h2>
          <p className={styles.heroCopy}>{t('improve.heroCopy')}</p>
        </div>
        <SkeletonRegion className={styles.completeness}>
          <p className={styles.completenessLabel}>{t('improve.completeness')}</p>
          <p className={styles.percent}>
            <Skeleton width={88} height={32} />
          </p>
          <div className={styles.bar} />
          <Skeleton width={120} />
        </SkeletonRegion>
      </Panel>

      <SectionHeading className={styles.heading} title={t('improve.heading')} description={t('improve.headingLead')} />
      <ul className={styles.grid}>
        {[140, 110, 160, 120].map((width) => (
          <li key={width}>
            <Panel padding={24} className={styles.card}>
              <div className={styles.cardHead}>
                <Skeleton shape="pill" width={64} />
              </div>
              <div className={styles.cardTitle}>
                <Skeleton width={width} height={16} />
              </div>
              <Skeleton shape="pill" width={96} height={40} />
            </Panel>
          </li>
        ))}
      </ul>
    </>
  )
}
