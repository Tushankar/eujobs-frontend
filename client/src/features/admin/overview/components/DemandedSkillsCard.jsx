import { useTranslation } from 'react-i18next'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Panel } from '@/components/ui'
import styles from './DemandedSkillsCard.module.css'

/** "Most demanded skills": the top required skills of published jobs, bars scaled to the first. `skills` = [{ skill, roles }]. */
export default function DemandedSkillsCard({ skills }) {
  const { t } = useTranslation('adminOverview')
  const max = Math.max(...skills.map((item) => item.roles), 1)
  return (
    <Panel padding={24} aria-labelledby="demanded-skills-title">
      <SectionTitle id="demanded-skills-title" title={t('skills.title')} description={t('skills.description')} />
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
    </Panel>
  )
}
