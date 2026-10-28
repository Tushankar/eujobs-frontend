import { Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { DEMANDED_SKILLS, QUALITY_NOTES } from '../data/analytics.js'
import styles from './InsightCards.module.css'

/** Horizontal bars of the skills named most often in current job requirements. */
export function DemandedSkills() {
  const max = Math.max(...DEMANDED_SKILLS.map((skill) => skill.count))
  return (
    <Panel padding={24}>
      <SectionTitle title="Most demanded skills" description="Based on current job requirements" />
      <ul className={styles.skills}>
        {DEMANDED_SKILLS.map((skill) => (
          <li className={styles.skill} key={skill.name}>
            <span className={styles.skillName}>{skill.name}</span>
            <span
              className={styles.track}
              role="img"
              aria-label={`${skill.name}: named in ${skill.count} job ${skill.count === 1 ? 'requirement' : 'requirements'}`}
            >
              <span className={styles.fill} style={{ width: `${(skill.count / max) * 100}%` }} />
            </span>
            <span className={styles.count}>{skill.count}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** What a trustworthy matching-quality view still needs: each item is honest about being unmeasured. */
export function MatchingQuality() {
  return (
    <Panel padding={24}>
      <SectionTitle title="Matching quality needs more than a score" />
      <div className={styles.notes}>
        {QUALITY_NOTES.map((note) => (
          <div key={note.title}>
            <h3 className={styles.noteTitle}>{note.title}</h3>
            <PillBadge tone="accent">{note.status}</PillBadge>
            <p className={styles.noteText}>{note.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
