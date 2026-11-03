import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, ShieldCheck } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import { useGetCourseQuery } from '@/features/learning/api.js'
import CourseAction from '@/features/learning/components/CourseAction.jsx'
import QuizCard from '@/features/learning/components/QuizCard.jsx'
import { useCourseText } from '@/features/learning/useCourseText.js'
import LessonRow from '../components/LessonRow.jsx'
import styles from './CourseDetailsPage.module.css'

const LIBRARY_PATH = '/recruiter/learning'

/** Recruiter learning, course view: hero, outcomes, curriculum states, details and the price or enrolment card. */
export default function CourseDetailsPage() {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const text = useCourseText()
  const { courseId } = useParams()
  const { data: course, isError } = useGetCourseQuery(courseId)

  const backLink = (
    <Link to={LIBRARY_PATH} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('library.back')}
    </Link>
  )

  if (isError) {
    return (
      <div>
        {backLink}
        <EmptyState
          icon={BookOpen}
          title={t('details.missingTitle')}
          description={t('details.missingText')}
          action={
            <Button as={Link} to={LIBRARY_PATH}>
              {t('library.browse')}
            </Button>
          }
        />
      </div>
    )
  }
  if (!course) return backLink

  const done = course.enrollment?.lessonsDone
  return (
    <div>
      {backLink}
      <PageTitle eyebrow={`${course.category} · ${text.level(course)}`} title={course.title} description={course.lead} actions={<PillBadge tone="accent">{text.duration(course)}</PillBadge>} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <figure className={styles.hero}>
            {course.coverUrl && <img src={course.coverUrl} alt="" className={styles.heroImage} width={784} height={320} />}
            <figcaption className={styles.caption}>
              <PillBadge tone="info">{course.category}</PillBadge>
              <p className={styles.tagline}>{course.tagline}</p>
            </figcaption>
          </figure>

          <section className={styles.section} aria-labelledby="outcomes">
            <SectionHeading id="outcomes" title={t('details.outcomesTitleRecruiter')} description={t('details.outcomesLeadRecruiter')} />
            <ol className={styles.outcomes}>
              {course.outcomes.map((outcome, index) => (
                <li key={outcome} className={styles.outcome}>
                  <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                  <p>{outcome}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.section} aria-labelledby="curriculum">
            <SectionHeading
              id="curriculum"
              title={t('details.curriculumTitle')}
              description={[t('details.curriculumLead', { count: course.lessons, duration: text.duration(course) }), course.enrollment && t('details.progressText', { done, total: course.lessons })].filter(Boolean).join(' · ')}
            />
            <ul className={styles.lessons}>
              {course.curriculum.map((lesson, index) => (
                <li key={lesson.id}>
                  <LessonRow
                    number={index + 1}
                    lesson={lesson}
                    to={`${LIBRARY_PATH}/${course.id}/lessons/${lesson.id}`}
                    subtitle={[t(`enums:lessonType.${lesson.type}`), lesson.durationSec && format.duration(lesson.durationSec)].filter(Boolean).join(' · ')}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="details">
            <SectionHeading id="details" title={t('details.detailsTitle')} />
            <dl className={styles.details}>
              {[
                [t('details.stream'), course.category],
                [t('details.level'), text.level(course)],
                [t('details.time'), text.duration(course)],
                [t('details.designedFor'), course.designedFor],
              ].map(([term, description]) => (
                <div key={term} className={styles.detail}>
                  <dt>{term}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className={styles.aside}>
          <section className={styles.price}>
            <p className={styles.priceLabel}>{t('price.label')}</p>
            <p className={styles.priceValue} data-course-price>
              {text.price(course)}
            </p>
            <p className={styles.access}>{text.access(course)}</p>
            <ul className={styles.included}>
              {text.included(course).map((item) => (
                <li key={item}>
                  <Icon as={Check} size={13} strokeWidth={2.2} />
                  {item}
                </li>
              ))}
            </ul>
            <CourseAction course={course} />
          </section>
          <QuizCard course={course} />
          <section className={styles.accountability}>
            <Icon as={ShieldCheck} size={21} />
            <h2>{t('details.accountabilityTitle')}</h2>
            <p>{t('details.accountabilityText')}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
