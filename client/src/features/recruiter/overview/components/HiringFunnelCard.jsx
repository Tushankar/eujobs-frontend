import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useGetFunnelQuery } from '@/features/recruiter/applications/api.js'
import SectionHeading from './SectionHeading.jsx'
import styles from './HiringFunnelCard.module.css'

// The default pipeline's six stages, so the card keeps its height when the stages arrive.
const SKELETON_STAGES = 6

/** "Your hiring funnel" (M-178): per company stage, the applications that ever reached it; rows open the pipeline. */
export default function HiringFunnelCard() {
  const { t } = useTranslation()
  const { data, isLoading } = useGetFunnelQuery()
  const stages = data?.items ?? []
  const max = Math.max(...stages.map((stage) => stage.count), 1)
  return (
    <section className={styles.card} aria-labelledby="funnel-title" data-card="funnel">
      <SectionHeading id="funnel-title" title={t('applications:overview.funnelTitle')} description={t('applications:overview.funnelDescription')} />
      {isLoading ? (
        <SkeletonRegion className={styles.list}>
          {Array.from({ length: SKELETON_STAGES }, (_, index) => (
            <div key={index} className={styles.row}>
              <span className={styles.stage}>
                <Skeleton width={[48, 60, 64, 52, 40, 36][index]} />
              </span>
              <Skeleton height={8} className={styles.skeletonTrack} />
              <span className={styles.count}>
                <Skeleton width={12} />
              </span>
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <ul className={styles.list}>
          {stages.map(({ id, name, count }) => (
            <li key={id} data-funnel-stage={name} data-count={count}>
              <Link to="/recruiter/hiring-pipeline" className={styles.row} aria-label={t('applications:overview.funnelRow', { stage: name, count })}>
                <span className={styles.stage}>{name}</span>
                <span className={styles.track}>
                  <span className={styles.fill} style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className={styles.count}>{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/recruiter/hiring-pipeline" className={styles.link}>
        {t('applications:overview.funnelLink')}
        <Icon as={ArrowRight} size={12} />
      </Link>
    </section>
  )
}
