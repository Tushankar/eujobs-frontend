import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Panel } from '@/components/ui'
import styles from './DemandedSkillsCard.module.css'

/** "Most demanded skills": horizontal bars scaled to the most requested skill. `skills` = [{ skill, roles }]. */
export default function DemandedSkillsCard({ skills }) {
  const max = Math.max(...skills.map((item) => item.roles), 1)

  return (
    <Panel padding={24} aria-labelledby="demanded-skills-title">
      <SectionTitle id="demanded-skills-title" title="Most demanded skills" description="Based on current job requirements" />
      <ul className={styles.list}>
        {skills.map((item) => (
          <li key={item.skill} className={styles.row}>
            <span className={styles.label}>{item.skill}</span>
            <span
              className={styles.track}
              role="img"
              aria-label={`${item.skill}: required by ${item.roles} ${item.roles === 1 ? 'role' : 'roles'}`}
            >
              <span className={styles.fill} style={{ width: `${(item.roles / max) * 100}%` }} />
            </span>
            <span className={styles.count}>{item.roles}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
