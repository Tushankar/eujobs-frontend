import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import { useFormat } from '@/lib/preferences.js'
import { useCourseText } from '@/features/learning/useCourseText.js'
import styles from './CourseCard.module.css'

/**
 * Catalogue card: cover, category, level and length, summary, "Free" or the price (M-100), and View or Continue. A
 * suggested course (OQ-3) names the gap skills it covers.
 */
export default function CourseCard({ course }) {
  const { t } = useTranslation('learning')
  const text = useCourseText()
  const format = useFormat()
  const started = course.enrollment?.lessonsDone > 0
  return (
    <article className={styles.card} data-course-card={course.id}>
      <div className={cx(styles.header, styles.headerCompact)}>
        <span className={styles.tile}>
          <Icon as={BookOpen} size={20} />
        </span>
        <div className={styles.badges}>
          {course.matchedSkills && <PillBadge tone="accent">{t('suggestions.matches', { skills: format.list(course.matchedSkills) })}</PillBadge>}
          {course.enrollment && <PillBadge tone="success">{t('card.enrolled')}</PillBadge>}
        </div>
      </div>

      {course.coverUrl && <img src={course.coverUrl} alt="" className={styles.photo} width={323} height={129} />}
      <h3 className={styles.title}>{course.title}</h3>
      <p className={styles.meta}>
        <span>{course.category}</span>
        <span aria-hidden="true">·</span>
        <span>{text.level(course)}</span>
        <span aria-hidden="true">·</span>
        <span>{text.duration(course)}</span>
      </p>
      <p className={styles.summary}>{course.summary}</p>

      <div className={styles.footer}>
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
            to={`/candidate/learning/${course.id}`}
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
