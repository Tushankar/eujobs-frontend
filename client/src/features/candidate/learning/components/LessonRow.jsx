import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, CirclePlay, LockKeyhole } from 'lucide-react'
import { Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import styles from './LessonRow.module.css'

/**
 * A row of the curriculum (M-099: no manual "Mark complete"). `state` is the server's: done, open (enrolled, or a
 * free preview, M-106) or locked. Open and done rows link to the lesson.
 */
export default function LessonRow({ lesson, title, subtitle, to }) {
  const { t } = useTranslation('learning')
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const content = (
    <>
      <span className={cx(styles.circle, !locked && styles.open, done && styles.done)}>
        <Icon as={locked ? LockKeyhole : done ? Check : CirclePlay} size={15} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      {lesson.isPreview && !done && <PillBadge tone="info">{t('curriculum.preview')}</PillBadge>}
      <span className={cx(styles.state, done && styles.stateDone)}>{t(`curriculum.${lesson.state}`)}</span>
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
