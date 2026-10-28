import { Earth, MapPin } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import CandidateAvatar from './CandidateAvatar.jsx'
import styles from './ProfileSummary.module.css'

/** Header card of the candidate profile: identity, availability, listed facts and the first four skills. */
export default function ProfileSummary({ candidate }) {
  return (
    <section className={styles.card} aria-labelledby="candidate-name">
      <div className={styles.identity}>
        <CandidateAvatar candidate={candidate} />
        <div className={styles.text}>
          <h1 className={styles.name} id="candidate-name">
            {candidate.name}
          </h1>
          <p className={styles.role}>
            {candidate.title} at {candidate.company}
          </p>
        </div>
        <PillBadge tone="success" dot className={styles.availability}>
          {candidate.availability}
        </PillBadge>
      </div>

      <p className={styles.facts}>
        <span className={styles.fact}>
          <Icon as={MapPin} size={13} />
          {candidate.location}
        </span>
        <span>{candidate.experienceYears} years of experience</span>
        <span className={styles.fact}>
          <Icon as={Earth} size={13} />
          {candidate.workMode}
        </span>
      </p>

      <ul className={styles.skills} aria-label="Listed skills">
        {candidate.skills.slice(0, 4).map((skill) => (
          <li key={skill}>
            <PillBadge>{skill}</PillBadge>
          </li>
        ))}
      </ul>
    </section>
  )
}
