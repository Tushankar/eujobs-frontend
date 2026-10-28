import { useOutletContext } from 'react-router-dom'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import { candidateDetails } from '../data/candidateDetails.js'
import styles from './CandidateOverviewPage.module.css'

export default function CandidateOverviewPage() {
  const { candidate } = useOutletContext()
  const { about, roles } = candidateDetails[candidate.id]
  const current = roles[0]

  return (
    <ProfileSection labelledBy="overview-about">
      <SectionTitle id="overview-about" title="The person behind the profile" />
      <p className={styles.about}>{about}</p>

      <SectionTitle className={styles.next} title="Relevant experience" />
      <div className={styles.role}>
        <h3 className={styles.roleTitle}>{current.role}</h3>
        <p className={styles.roleMeta}>
          {current.org} · {current.period}
        </p>
        <p className={styles.roleSummary}>
          Contributed to product strategy and end-to-end delivery. This demo summary illustrates candidate-provided
          experience; verify outcomes during the interview.
        </p>
      </div>

      <SectionTitle className={styles.next} title="A possible next step" />
      <p className={styles.nextStep}>
        Seeking {candidate.workMode.toLowerCase()} opportunities with space to grow, work with thoughtful teams, and make
        a meaningful impact.
      </p>
    </ProfileSection>
  )
}
