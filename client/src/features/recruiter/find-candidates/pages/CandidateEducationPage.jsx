import { useOutletContext } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { Icon } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import { getCandidateDetails } from '../data/candidateDetails.js'
import styles from './CandidateEducationPage.module.css'

export default function CandidateEducationPage() {
  const { candidate } = useOutletContext()
  const { education } = getCandidateDetails(candidate)

  return (
    <ProfileSection labelledBy="education-title">
      <SectionTitle id="education-title" title="Education" />
      <div className={styles.entry}>
        <Icon as={GraduationCap} size={22} strokeWidth={2} className={styles.icon} />
        <div>
          <h3 className={styles.degree}>{education.degree}</h3>
          <p className={styles.meta}>Sample education · {education.period}</p>
          <p className={styles.note}>
            Verify education with the candidate if relevant to the role. Credentials aren’t a substitute for evidence of
            skills.
          </p>
        </div>
      </div>
    </ProfileSection>
  )
}
