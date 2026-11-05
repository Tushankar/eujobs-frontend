import { useTranslation } from 'react-i18next'
import { Skeleton, SkeletonRegion } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './PipelineStages.module.css'

/** The six stage cards while the counts load. */
export function StagesSkeleton() {
  return (
    <SkeletonRegion className={styles.grid}>
      {[64, 72, 56, 48, 52, 60].map((width, index) => (
        <div key={index} className={styles.card}>
          <span className={styles.label}>
            <Skeleton width={width} />
          </span>
          <span className={styles.value}>
            <Skeleton width={32} height={24} />
          </span>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** M-178: applications per category at their current stage (withdrawn excluded). Selecting one filters the movement table. */
export default function PipelineStages({ stages, selectedStage, onSelectStage }) {
  const { t } = useTranslation(['adminRecruitment', 'enums'])
  return (
    <ul className={styles.grid} aria-label={t('stagesLabel')}>
      {stages.map(({ category, count }) => {
        const active = category === selectedStage
        return (
          <li key={category}>
            <button type="button" className={cx(styles.card, active && styles.active)} aria-pressed={active} onClick={() => onSelectStage(category)} data-stage={category}>
              <span className={styles.label}>{t(`enums:stageCategory.${category}`)}</span>
              <span className={styles.value}>{count}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
