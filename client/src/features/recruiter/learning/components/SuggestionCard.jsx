import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCourseText } from '@/features/learning/useCourseText.js'
import styles from './SuggestionCard.module.css'

/**
 * A "Suggested for you" card (OQ-3): cover with its rank tag, stream and length, the title, and why it is suggested:
 * "{n} active applications at {stage}" from the company's pipeline.
 */
export default function SuggestionCard({ course, rank }) {
  const { t } = useTranslation('learning')
  const text = useCourseText()
  return (
    <article className={styles.card} data-suggestion={course.id}>
      <div className={styles.media}>
        {course.coverUrl && <img src={course.coverUrl} alt="" className={styles.photo} width={363} height={128} loading="lazy" />}
        <PillBadge tone={rank === 1 ? 'info' : 'accent'} className={styles.tag}>
          {t(rank === 1 ? 'suggestions.best' : 'suggestions.rank', { rank })}
        </PillBadge>
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>
          {course.category} · {text.duration(course)}
        </p>
        <h3 className={styles.title}>{course.title}</h3>
        <p className={styles.reason} data-suggestion-reason>
          {t('suggestions.reason', { count: course.reason.count, stage: t(`enums:stageCategory.${course.reason.stage}`) })}
        </p>
        <Link to={`/recruiter/learning/${course.id}`} className={styles.link} aria-label={t('card.viewLabel', { title: course.title })}>
          {t('card.view')}
          <Icon as={ArrowRight} size={11} />
        </Link>
      </div>
    </article>
  )
}
