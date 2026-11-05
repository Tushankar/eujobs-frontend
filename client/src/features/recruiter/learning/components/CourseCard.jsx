import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button, Icon, Skeleton } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCourseText } from '@/features/learning/useCourseText.js'
import styles from './CourseCard.module.css'

/** Learning library card: cover, stream, level, length and lessons, summary, "Free" or the price, and View or Continue. */
export default function CourseCard({ course }) {
  const { t } = useTranslation('learning')
  const text = useCourseText()
  const started = course.enrollment?.lessonsDone > 0
  return (
    <article className={styles.card} data-course-card={course.id}>
      {course.coverUrl && <img src={course.coverUrl} alt="" className={styles.photo} width={363} height={203} loading="lazy" />}
      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.tile}>
            <Icon as={BookOpen} size={18} />
          </span>
          <PillBadge tone="accent">{course.category}</PillBadge>
          {course.enrollment && <PillBadge tone="success">{t('card.enrolled')}</PillBadge>}
        </div>
        <h3 className={styles.title}>{course.title}</h3>
        <p className={styles.meta}>
          {text.level(course)} · {text.duration(course)} · {t('details.lessonCount', { count: course.lessons })}
        </p>
        <p className={styles.summary}>{course.summary}</p>

        <div className={styles.priceRow}>
          <div>
            <p className={styles.priceLabel}>{t('price.label')}</p>
            <p className={styles.price} data-course-price>
              {text.price(course)}
            </p>
          </div>
          <p className={styles.access}>{text.access(course)}</p>
        </div>

        <div className={styles.actions}>
          <Button
            as={Link}
            to={`/recruiter/learning/${course.id}`}
            variant="outline"
            rightIcon={<Icon as={ArrowRight} size={13} />}
            aria-label={t(started ? 'card.continueLabel' : 'card.viewLabel', { title: course.title })}
          >
            {t(started ? 'card.continue' : 'card.view')}
          </Button>
        </div>
      </div>
    </article>
  )
}

/** A library card's shape while the courses load: the cover, the course's lines and the price row. */
export function CourseCardSkeleton() {
  const { t } = useTranslation('learning')
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton shape="block" height={203} className={styles.skeletonPhoto} />
      <div className={styles.body}>
        <div className={styles.header}>
          <Skeleton shape="circle" width={18} height={18} />
          <Skeleton shape="pill" width={88} />
        </div>
        <p className={styles.title}>
          <Skeleton width="85%" height={16} />
          <br />
          <Skeleton width="40%" height={16} />
        </p>
        <p className={styles.meta}>
          <Skeleton width="60%" />
        </p>
        <div className={styles.summary}>
          <Skeleton />
          <br />
          <Skeleton />
          <br />
          <Skeleton width="70%" />
        </div>
        <div className={styles.priceRow}>
          <div>
            <p className={styles.priceLabel}>{t('price.label')}</p>
            <p className={styles.price}>
              <Skeleton width={56} height={20} />
            </p>
          </div>
          <p className={styles.access}>
            <Skeleton width={72} />
          </p>
        </div>
        <div className={styles.actions}>
          <Skeleton shape="pill" height={40} width="100%" />
        </div>
      </div>
    </div>
  )
}
