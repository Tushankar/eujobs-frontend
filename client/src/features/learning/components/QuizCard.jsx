import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, LockKeyhole } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { useLearningPath } from '../useCourseText.js'
import CertificateBlock from './CertificateBlock.jsx'
import styles from './CertificateBlock.module.css'

/**
 * The final quiz on a course page (M-104): locked until every lesson is complete, then open with the best score so
 * far; once passed, the certificate (M-105). Shown to enrolled learners only.
 */
export default function QuizCard({ course }) {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const base = useLearningPath()
  const { enrollment } = course
  if (!enrollment) return null
  if (course.certificate) return <CertificateBlock certificate={course.certificate} />

  const unlocked = enrollment.lessonsDone === course.lessons
  const percent = (value) => format.number(value / 100, { style: 'percent' })
  return (
    <Panel padding={24} className={styles.block} data-quiz-card={unlocked ? 'open' : 'locked'}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <Icon as={unlocked ? ClipboardCheck : LockKeyhole} size={20} />
        </span>
        <div>
          <h2 className={styles.title}>{t('quiz.title')}</h2>
          <p className={styles.meta}>{t('quiz.summary', { count: course.quiz.questions, passMark: percent(course.quiz.passMark) })}</p>
        </div>
      </div>
      <p className={styles.note}>{t(unlocked ? 'quiz.unlockedText' : 'quiz.lockedText')}</p>
      {enrollment.quizBestScore !== null && <p className={styles.meta}>{t('quiz.best', { score: percent(enrollment.quizBestScore) })}</p>}
      {unlocked && (
        <div className={styles.actions}>
          <Button as={Link} to={`${base}/${course.id}/quiz`} rightIcon={<Icon as={ArrowRight} size={14} />} data-take-quiz>
            {t('quiz.take')}
          </Button>
        </div>
      )}
    </Panel>
  )
}
