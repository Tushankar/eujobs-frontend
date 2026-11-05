import { useTranslation } from 'react-i18next'
import { Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import styles from './InsightCards.module.css'

const QUALITY_NOTES = ['relevance', 'conversion', 'fairness']

/* Placeholder rows while loading (the server sends the top 6): name and bar widths. */
const SKELETON_SKILLS = [
  [96, 100],
  [72, 82],
  [108, 64],
  [80, 52],
  [64, 40],
  [88, 28],
]

/** Horizontal bars of the skills published jobs require most (server data). `skills` = [{ skill, roles }]. */
export function DemandedSkills({ skills, loading }) {
  const { t } = useTranslation('adminOverview')
  const max = Math.max(...skills.map((item) => item.roles), 1)
  return (
    <Panel padding={24}>
      <SectionTitle title={t('skills.title')} description={t('skills.description')} />
      {loading ? (
        <SkeletonRegion>
          <div className={styles.skills}>
            {SKELETON_SKILLS.map(([name, bar], index) => (
              <div key={index} className={styles.skill}>
                <span className={styles.skillName}>
                  <Skeleton width={name} />
                </span>
                <span className={styles.track}>
                  <Skeleton height={8} width={`${bar}%`} className={styles.skeletonFill} />
                </span>
                <span className={styles.count}>
                  <Skeleton width={14} height={10} />
                </span>
              </div>
            ))}
          </div>
        </SkeletonRegion>
      ) : (
        <>
          {skills.length === 0 && <p className={styles.noteText}>{t('skills.empty')}</p>}
          <ul className={styles.skills}>
            {skills.map((item) => (
              <li className={styles.skill} key={item.skill} data-skill={item.skill}>
                <span className={styles.skillName}>{item.skill}</span>
                <span className={styles.track} role="img" aria-label={t('skills.bar', { skill: item.skill, count: item.roles })}>
                  <span className={styles.fill} style={{ width: `${(item.roles / max) * 100}%` }} />
                </span>
                <span className={styles.count}>{item.roles}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

/** M-175: what a trustworthy matching-quality view still needs, as explanatory copy (not data). */
export function MatchingQuality() {
  const { t } = useTranslation('adminOverview')
  return (
    <Panel padding={24}>
      <SectionTitle title={t('quality.title')} />
      <div className={styles.notes}>
        {QUALITY_NOTES.map((key) => (
          <div key={key}>
            <h3 className={styles.noteTitle}>{t(`quality.${key}.title`)}</h3>
            <PillBadge tone="accent">{t(`quality.${key}.status`)}</PillBadge>
            <p className={styles.noteText}>{t(`quality.${key}.text`)}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
