import { useOutletContext } from 'react-router-dom'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateSkillsPage.module.css'

export default function CandidateSkillsPage() {
  const { candidate } = useOutletContext()

  return (
    <ProfileSection labelledBy="skills-title">
      <SectionTitle id="skills-title" title="Listed skills & evidence" />
      <ul className={styles.list}>
        {candidate.skills.map((skill) => (
          <li key={skill} className={styles.skill}>
            <span className={styles.name}>{skill}</span>
            <PillBadge tone="accent">Candidate-provided</PillBadge>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Skills are stated by the candidate, not independently verified. Assess role-specific proficiency through a fair,
        structured process.
      </p>
    </ProfileSection>
  )
}
