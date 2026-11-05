import { useTranslation } from 'react-i18next'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import styles from './DemandedSkillsCard.module.css'

/* Placeholder rows while loading (the server sends the top 6): name and bar widths. */
const SKELETON_ROWS = [
  [96, 100],
  [72, 82],
  [108, 64],
  [80, 52],
  [64, 40],
  [88, 28],
]

/** "Most demanded skills": the top required skills of published jobs, bars scaled to the first. `skills` = [{ skill, roles }]. */
export default function DemandedSkillsCard({ skills, loading }) {
  const { t } = useTranslation('adminOverview')
  const max = Math.max(...skills.map((item) => item.roles), 1)
  return (
    <Panel padding={24} aria-labelledby="demanded-skills-title">
      <SectionTitle id="demanded-skills-title" title={t('skills.title')} description={t('skills.description')} />
      {loading ? (
        <SkeletonRegion>
          <div className={styles.list}>
            {SKELETON_ROWS.map(([name, bar], index) => (
              <div key={index} className={styles.row}>
                <span className={styles.label}>
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
          {skills.length === 0 && <p className={styles.empty}>{t('skills.empty')}</p>}
          <ul className={styles.list}>
            {skills.map((item) => (
              <li key={item.skill} className={styles.row} data-skill={item.skill}>
                <span className={styles.label}>{item.skill}</span>
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
