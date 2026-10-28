import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './SuggestionCard.module.css'

/** "Recommended for you" card: photo with a tag, stream and duration, the course title and why it is suggested. */
export default function SuggestionCard({ suggestion, course }) {
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <img src={course.photo} alt="" className={styles.photo} width={363} height={128} loading="lazy" />
        <PillBadge tone={suggestion.tone} className={styles.tag}>
          {suggestion.tag}
        </PillBadge>
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>
          {course.stream} · {course.duration}
        </p>
        <h3 className={styles.title}>{course.title}</h3>
        <p className={styles.reason}>{suggestion.reason}</p>
        <Link to={`/recruiter/learning/${course.id}`} className={styles.link} aria-label={`View course: ${course.title}`}>
          View course
          <Icon as={ArrowRight} size={11} />
        </Link>
      </div>
    </article>
  )
}
