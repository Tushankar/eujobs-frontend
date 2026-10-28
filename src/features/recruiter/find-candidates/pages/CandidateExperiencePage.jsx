import { useOutletContext } from 'react-router-dom'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import { candidateDetails } from '../data/candidateDetails.js'
import styles from './CandidateExperiencePage.module.css'

export default function CandidateExperiencePage() {
  const { candidate } = useOutletContext()
  const { roles } = candidateDetails[candidate.id]

  return (
    <ProfileSection labelledBy="experience-title">
      <SectionTitle id="experience-title" title="Career history" />
      <ol className={styles.list}>
        {roles.map((entry) => (
          <li key={`${entry.role}-${entry.period}`} className={styles.entry}>
            <h3 className={styles.role}>{entry.role}</h3>
            <p className={styles.meta}>
              {entry.org} · {entry.period}
            </p>
            <p className={styles.summary}>
              Worked with engineering and product partners on research, design, and delivery. Sample career history for
              this demo profile.
            </p>
          </li>
        ))}
      </ol>
    </ProfileSection>
  )
}
