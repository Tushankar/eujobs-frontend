import { Check, CirclePlay, LockKeyhole } from 'lucide-react'
import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import { LESSON_SUBTITLE } from '../data/courses.js'
import styles from './LessonRow.module.css'

/**
 * A curriculum row. Locked until the course is purchased (the click then offers the purchase); once unlocked it
 * toggles between "Mark complete" and "Completed".
 */
export default function LessonRow({ number, title, unlocked, done, onClick }) {
  const state = !unlocked ? 'Start course' : done ? 'Completed' : 'Mark complete'
  return (
    <button
      type="button"
      className={cx(styles.row, !unlocked && styles.locked)}
      aria-pressed={unlocked ? done : undefined}
      aria-label={unlocked ? undefined : `Lesson ${number}: ${title}. Buy the course to unlock it.`}
      onClick={onClick}
    >
      <span className={cx(styles.circle, done && styles.done)}>
        <Icon as={!unlocked ? LockKeyhole : done ? Check : CirclePlay} size={15} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          {number}. {title}
        </span>
        <span className={styles.subtitle}>{LESSON_SUBTITLE}</span>
      </span>
      <span className={cx(styles.state, done && styles.stateDone)}>{state}</span>
    </button>
  )
}
