import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Check } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { formatPrice } from '../hooks/useRecruiterLearning.js'
import styles from './CourseCard.module.css'

/** Learning library card: photo, stream, summary, price and the View course / Buy now actions. */
export default function CourseCard({ course, progress, onBuy }) {
  return (
    <article className={styles.card}>
      <img src={course.photo} alt="" className={styles.photo} width={363} height={203} loading="lazy" />
      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.tile}>
            <Icon as={BookOpen} size={18} />
          </span>
          <PillBadge tone="accent">{course.stream}</PillBadge>
        </div>
        <h3 className={styles.title}>{course.title}</h3>
        <p className={styles.meta}>
          {course.level} · {course.duration} · {course.lessons.length} lessons
        </p>
        <p className={styles.summary}>{course.summary}</p>

        <div className={styles.priceRow}>
          <div>
            <p className={styles.priceLabel}>Course price</p>
            <p className={styles.price}>{formatPrice(course.price)}</p>
          </div>
          <p className={styles.access}>{course.access}</p>
        </div>

        <div className={styles.actions}>
          <Button
            as={Link}
            to={`/recruiter/learning/${course.id}`}
            variant="outline"
            rightIcon={<Icon as={ArrowRight} size={13} />}
            aria-label={`${progress.started ? 'Continue' : 'View'} course: ${course.title}`}
          >
            {progress.started ? 'Continue course' : 'View course'}
          </Button>
          {progress.purchased ? (
            <Button variant="secondary" disabled leftIcon={<Icon as={Check} size={13} />} aria-label={`${course.title} is purchased`}>
              Purchased
            </Button>
          ) : (
            <Button onClick={onBuy} aria-label={`Buy ${course.title}`}>
              Buy now
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
