import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, CirclePlay, GraduationCap, ShieldCheck } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetCourseQuery } from '@/features/learning/api.js'
import CourseAction from '@/features/learning/components/CourseAction.jsx'
import QuizCard from '@/features/learning/components/QuizCard.jsx'
import { useCourseText } from '@/features/learning/useCourseText.js'
import Translatable from '@/features/ai/components/Translatable.jsx'
import LessonRow from '../components/LessonRow.jsx'
import styles from './LearningDetailsPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

const BASE = '/candidate/learning'

/** Course details: the free preview lesson (M-106), outcomes, curriculum states, price or enrolment, and progress. */
export default function LearningDetailsPage() {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const text = useCourseText()
  const { courseId } = useParams()
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('course', courseId)
  const { data: course, isError } = useGetCourseQuery(courseId)

  const back = (
    <Link to={BASE} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('details.back')}
    </Link>
  )
  if (isError) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t('details.missingTitle')}
        description={t('details.missingText')}
        action={
          <Button as={Link} to={BASE}>
            {t('details.back')}
          </Button>
        }
      />
    )
  }
  if (!course) return back

  const preview = !course.enrollment && course.curriculum.find((lesson) => lesson.isPreview)
  const percent = text.progress(course)
  const lessonPath = (lesson) => `${BASE}/${course.id}/lessons/${lesson.id}`

  return (
    <>
      {back}
      <PageTitle
        eyebrow={`${course.category} · ${text.level(course)}`}
        title={course.title}
        description={course.summary}
        actions={course.enrollment?.completedAt ? <PillBadge tone="success">{t('details.completed')}</PillBadge> : course.enrollment ? <PillBadge tone="warning">{t('card.enrolled')}</PillBadge> : null}
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          {preview && (
            <section className={styles.hero} aria-labelledby="intro-heading">
              <div className={styles.heroTop}>
                <PillBadge tone="info">{t('details.previewBadge', { duration: format.duration(preview.durationSec ?? 60) })}</PillBadge>
                <Icon as={BookOpen} size={22} />
              </div>
              <h2 className={styles.heroTitle} id="intro-heading">
                {t('details.previewTitle')}
              </h2>
              <p className={styles.heroText}>{t('details.previewText', { lesson: preview.title })}</p>
              <Button as={Link} to={lessonPath(preview)} leftIcon={<Icon as={CirclePlay} size={15} />} data-open-preview>
                {t('details.previewButton')}
              </Button>
            </section>
          )}

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('details.outcomesTitle')}</h2>
            <p className={styles.sectionLead}>{t('details.outcomesLead')}</p>
            <ol className={styles.outcomes}>
              {course.outcomes.map((outcome, index) => (
                <li key={outcome} className={styles.outcome}>
                  <span className={styles.outcomeNumber}>{index + 1}</span>
                  <p>{outcome}</p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('details.curriculumTitle')}</h2>
            <p className={styles.sectionLead}>{t('details.curriculumLead', { count: course.lessons, duration: text.duration(course) })}</p>
            <div className={styles.lessons}>
              {course.curriculum.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  to={lessonPath(lesson)}
                  title={`${index + 1}. ${lesson.title}`}
                  subtitle={[t(`enums:lessonType.${lesson.type}`), lesson.durationSec && format.duration(lesson.durationSec)].filter(Boolean).join(' · ')}
                />
              ))}
            </div>
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('details.aboutTitle')}</h2>
            <Translatable source={{ entity: 'course', id: course.id, field: 'about' }} texts={[course.about]}>
              {([about]) => <p className={styles.about}>{about}</p>}
            </Translatable>
            <ul className={styles.tags}>
              <li>
                <PillBadge>{text.level(course)}</PillBadge>
              </li>
              <li>
                <PillBadge>{text.duration(course)}</PillBadge>
              </li>
              <li>
                <PillBadge>{t('details.lessonCount', { count: course.lessons })}</PillBadge>
              </li>
              <li>
                <PillBadge tone="accent">{course.category}</PillBadge>
              </li>
            </ul>
          </Panel>
        </div>

        <aside className={`${styles.side} sticky-side`}>
          <Panel padding={24}>
            <p className={styles.priceLabel}>{t('price.label')}</p>
            <p className={styles.price} data-course-price>
              {text.price(course)}
            </p>
            <p className={styles.access}>{text.access(course)}</p>
            <ul className={styles.included}>
              {text.included(course).map((item) => (
                <li key={item}>
                  <Icon as={Check} size={13} />
                  {item}
                </li>
              ))}
            </ul>
            <CourseAction course={course} />
          </Panel>

          <QuizCard course={course} />

          {course.enrollment && (
            <Panel padding={24}>
              <h2 className={styles.sectionTitle}>{t('details.progressTitle')}</h2>
              <p className={styles.percent}>{format.number(percent / 100, { style: 'percent' })}</p>
              <div className={styles.track} role="progressbar" aria-label={t('details.progressLabel')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <span className={styles.fill} style={{ width: `${percent}%` }} />
              </div>
              <p className={styles.progressText} aria-live="polite">
                {t('details.progressText', { done: course.enrollment.lessonsDone, total: course.lessons })}
              </p>
            </Panel>
          )}

          <section className={styles.evidence}>
            <Icon as={ShieldCheck} size={21} className={styles.evidenceIcon} />
            <h2 className={styles.evidenceTitle}>{t('details.evidenceTitle')}</h2>
            <p className={styles.evidenceText}>{t('details.evidenceText')}</p>
          </section>
        </aside>
      </div>
    </>
  )
}
