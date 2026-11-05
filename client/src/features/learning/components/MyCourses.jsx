import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useLearningPath } from '../useCourseText.js'
import styles from './MyCourses.module.css'

/**
 * "My courses" (owner 2026-11-05): one row per enrolment from GET /learning/enrollments, with how it was joined
 * (purchased or free) and when, the lesson progress, and Start / Continue / Review. `showPayment` adds the amount
 * paid and the Stripe receipt (recruiter Settings › My courses).
 */
export default function MyCourses({ items, loading, showPayment = false }) {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const learningPath = useLearningPath()

  if (loading) {
    return (
      <SkeletonRegion>
        <div className={styles.list}>
          {[0, 1].map((index) => (
            <div key={index} className={styles.row}>
              <Skeleton shape="block" className={styles.thumb} />
              <div className={styles.main}>
                <Skeleton width={220} />
                <Skeleton width={160} />
                <Skeleton width="100%" height={6} />
              </div>
            </div>
          ))}
        </div>
      </SkeletonRegion>
    )
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const done = Boolean(item.completedAt)
        const percent = Math.round((item.lessonsDone / Math.max(1, item.lessonsTotal)) * 100)
        const action = done ? 'review' : item.lessonsDone > 0 ? 'continue' : 'start'
        return (
          <li key={item.courseId} className={styles.row} data-my-course={item.courseId}>
            {item.course.coverUrl ? (
              <img src={item.course.coverUrl} alt="" className={styles.thumb} width={72} height={48} loading="lazy" />
            ) : (
              <span className={cx(styles.thumb, styles.thumbIcon)}>
                <Icon as={BookOpen} size={18} />
              </span>
            )}

            <div className={styles.main}>
              <Link to={`${learningPath}/${item.courseId}`} className={styles.title}>
                {item.course.title}
              </Link>
              <p className={styles.meta}>
                <span>{item.course.category}</span>
                <span aria-hidden="true">·</span>
                <span data-my-course-source={item.source}>
                  {t(item.source === 'purchase' ? 'myCourses.purchasedOn' : 'myCourses.enrolledOn', { date: format.date(item.payment?.paidAt ?? item.enrolledAt) })}
                </span>
              </p>
              <div className={styles.progress}>
                <span className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('myCourses.progressLabel', { title: item.course.title })}>
                  <span className={cx(styles.fill, done && styles.fillDone, 'grow-x')} style={{ width: `${percent}%` }} />
                </span>
                <span className={cx(styles.progressText, done && styles.doneText)}>
                  {done ? t('myCourses.completed', { date: format.date(item.completedAt) }) : t('myCourses.progress', { done: item.lessonsDone, total: item.lessonsTotal })}
                </span>
              </div>
              {item.certificate?.status === 'valid' && (
                <a href={`/certificates/${item.certificate.code}`} target="_blank" rel="noopener" className={styles.certificate}>
                  {t('myCourses.certificate', { code: item.certificate.code })}
                </a>
              )}
            </div>

            {showPayment && item.payment && (
              <div className={styles.payment}>
                <span className={styles.amount}>{format.money(item.payment.amountMinor, item.payment.currency)}</span>
                {item.payment.receiptUrl && (
                  <a href={item.payment.receiptUrl} target="_blank" rel="noopener noreferrer" className={styles.receipt}>
                    {t('myCourses.receipt')}
                    <Icon as={ExternalLink} size={12} />
                  </a>
                )}
              </div>
            )}

            <Button
              as={Link}
              to={`${learningPath}/${item.courseId}`}
              variant="outline"
              size="sm"
              className={styles.action}
              rightIcon={<Icon as={ArrowRight} size={13} />}
              aria-label={t('myCourses.actionLabel', { action: t(`myCourses.${action}`), title: item.course.title })}
            >
              {t(`myCourses.${action}`)}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
