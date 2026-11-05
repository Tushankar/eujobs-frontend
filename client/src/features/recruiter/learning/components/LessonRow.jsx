import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, CirclePlay, LockKeyhole } from 'lucide-react'
import { Icon, Skeleton } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './LessonRow.module.css'

/**
 * A curriculum row (M-099: no manual "Mark complete"). `lesson.state` is the server's: done, open (enrolled, or a
 * free preview, M-106) or locked until the course is bought. Open and done rows link to the lesson.
 */
export default function LessonRow({ number, lesson, subtitle, to }) {
  const { t } = useTranslation('learning')
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const content = (
    <>
      <span className={cx(styles.circle, done && styles.done)}>
        <Icon as={locked ? LockKeyhole : done ? Check : CirclePlay} size={15} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          {number}. {lesson.title}
        </span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      <span className={cx(styles.state, done && styles.stateDone)}>{t(lesson.isPreview && !done ? 'curriculum.preview' : `curriculum.${lesson.state}`)}</span>
    </>
  )
  if (locked) {
    return (
      <div className={cx(styles.row, styles.locked)} data-lesson-row={lesson.id} data-state="locked">
        {content}
      </div>
    )
  }
  return (
    <Link to={to} className={styles.row} data-lesson-row={lesson.id} data-state={lesson.state}>
      {content}
    </Link>
  )
}

/** A curriculum row's shape while the course loads. */
export function LessonRowSkeleton() {
  return (
    <div className={styles.row} aria-hidden="true">
      <Skeleton shape="circle" width={36} height={36} />
      <span className={styles.text}>
        <span className={styles.title}>
          <Skeleton width="45%" height={12} />
        </span>
        <span className={styles.subtitle}>
          <Skeleton width={96} height={8} />
        </span>
      </span>
      <Skeleton width={40} height={8} />
    </div>
  )
}
