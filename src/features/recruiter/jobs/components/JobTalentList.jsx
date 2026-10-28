import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import { RELEVANT_TALENT } from '../data/relevantTalent.js'
import styles from './JobTalentList.module.css'

/** "Discover relevant talent": the first `relevant` mock suggestions, each opening Find candidates. */
export default function JobTalentList({ relevant = 0 }) {
  const talent = RELEVANT_TALENT.slice(0, relevant)
  return (
    <>
      <h3 className={styles.heading}>Discover relevant talent</h3>
      {talent.length === 0 ? (
        <p className={styles.empty}>No profiles with relevant listed skills yet. Suggestions appear here as candidates update their profiles.</p>
      ) : (
        <ul className={styles.list}>
          {talent.map((person) => (
            <li key={person.id}>
              <Link to={`/recruiter/find-candidates/${person.id}`} className={styles.row} aria-label={`Open ${person.name} in Find candidates`}>
                <span className={`${styles.avatar} ${styles[person.tone]}`} aria-hidden="true">
                  {person.initials}
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{person.name}</span>
                  <span className={styles.headline}>{person.headline}</span>
                </span>
                <Icon as={ArrowUpRight} size={14} className={styles.arrow} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
