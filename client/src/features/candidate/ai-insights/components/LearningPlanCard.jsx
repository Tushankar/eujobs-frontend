import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import SectionHeading from './SectionHeading.jsx'
import styles from './LearningPlanCard.module.css'

/** P9-Q2: the skills the candidate plans to learn, kept on the server; a plan item never becomes a profile skill. */
export default function LearningPlanCard({ plan, onRemove, exploreLabel, exploreTo, loading }) {
  const { t } = useTranslation('aiInsights')
  return (
    <Panel padding={24} aria-labelledby="learning-plan-title" data-learning-plan={loading ? undefined : true}>
      <SectionHeading id="learning-plan-title" title={t('plan.title')} description={t('plan.lead')} />
      <div className={styles.box}>
        {loading ? (
          <SkeletonRegion className={styles.list}>
            {[120, 96].map((width) => (
              <div key={width} className={styles.item}>
                <Skeleton width={width} height={12} />
                <Skeleton width={48} />
              </div>
            ))}
          </SkeletonRegion>
        ) : plan.length === 0 ? (
          <p className={styles.text}>{t('plan.empty')}</p>
        ) : (
          <>
            <ul className={styles.list}>
              {plan.map((skill) => (
                <li key={skill} className={styles.item} data-plan-skill={skill}>
                  <span className={styles.skill}>{skill}</span>
                  <button type="button" className={styles.remove} aria-label={t('plan.removeLabel', { skill })} onClick={() => onRemove(skill)}>
                    {t('plan.remove')}
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.text}>{t('plan.note')}</p>
          </>
        )}
        <Link to={exploreTo} className={styles.link}>
          {exploreLabel}
          <Icon as={ArrowRight} size={13} strokeWidth={2} />
        </Link>
      </div>
    </Panel>
  )
}
