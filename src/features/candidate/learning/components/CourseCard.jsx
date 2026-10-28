import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import photo from '@/assets/images/learning-course-photo.jpg'
import { formatPrice } from '../hooks/useLearning.js'
import styles from './CourseCard.module.css'

/** Catalogue card. `recommended` adds the "Recommended for your gap" tag used in the gap section. */
export default function CourseCard({ course, progress, recommended = false, onBuy }) {
  const tierTone = course.tier === 'Plus' ? 'warning' : 'neutral'
  return (
    <article className={styles.card}>
      <div className={cx(styles.header, recommended && styles.headerCompact)}>
        <span className={styles.tile}>
          <Icon as={BookOpen} size={20} />
        </span>
        <div className={styles.badges}>
          {recommended && <PillBadge tone="accent">Recommended for your gap</PillBadge>}
          <PillBadge tone={tierTone}>{course.tier}</PillBadge>
        </div>
      </div>

      <img src={photo} alt="" className={styles.photo} width={323} height={129} />
      <h3 className={styles.title}>{course.title}</h3>
      <p className={styles.meta}>
        <span>{course.category}</span>
        <span aria-hidden="true">·</span>
        <span>{course.level}</span>
        <span aria-hidden="true">·</span>
        <span>{course.duration}</span>
      </p>
      <p className={styles.summary}>{course.summary}</p>

      <div className={styles.footer}>
        <div className={styles.priceRow}>
          <div>
            <p className={styles.priceLabel}>Course price</p>
            <p className={styles.price}>{formatPrice(course.price)}</p>
          </div>
          <p className={styles.access}>One-time course access</p>
        </div>
        <div className={styles.actions}>
          <Button
            as={Link}
            to={`/candidate/learning/${course.id}`}
            variant="outline"
            rightIcon={<Icon as={ArrowRight} size={13} />}
            aria-label={`${progress.started ? 'Continue' : 'View'} course: ${course.title}`}
          >
            {progress.started ? 'Continue course' : 'View course'}
          </Button>
          {progress.purchased ? (
            <Button className={styles.purchased} disabled aria-label={`${course.title} is purchased`}>
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
