import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, ShieldCheck } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import LessonRow from '../components/LessonRow.jsx'
import PurchaseDialog from '../components/PurchaseDialog.jsx'
import { getCourse } from '../data/courses.js'
import { formatPrice, useRecruiterLearning } from '../hooks/useRecruiterLearning.js'
import styles from './CourseDetailsPage.module.css'

const LIBRARY_PATH = '/recruiter/learning'
const INCLUDED = ['4 pre-recorded lessons', 'Completion assessment', 'Course-completion badge', 'Learn at your own pace']

/** Recruiter learning, course view: hero, outcomes, curriculum with unlock/complete states, details and the price card. */
export default function CourseDetailsPage() {
  const course = getCourse(useParams().courseId)
  const { progress, isLessonDone, purchase, toggleLesson } = useRecruiterLearning()
  const [buying, setBuying] = useState(false)

  const backLink = (
    <Link to={LIBRARY_PATH} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      Back to learning library
    </Link>
  )

  if (!course) {
    return (
      <div>
        {backLink}
        <EmptyState
          icon={BookOpen}
          title="Course not found"
          description="This course isn’t in the learning library. Pick another one to continue."
          action={
            <Button as={Link} to={LIBRARY_PATH}>
              Browse learning library
            </Button>
          }
        />
      </div>
    )
  }

  const { purchased, done, total } = progress(course)

  return (
    <div>
      {backLink}
      <PageTitle
        eyebrow={`${course.stream} · ${course.level}`}
        title={course.title}
        description={course.lead}
        actions={<PillBadge tone="accent">{course.duration}</PillBadge>}
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <figure className={styles.hero}>
            <img src={course.photo} alt="" className={styles.heroImage} width={784} height={320} />
            <figcaption className={styles.caption}>
              <PillBadge tone="info">{course.stream}</PillBadge>
              <p className={styles.tagline}>{course.tagline}</p>
            </figcaption>
          </figure>

          <section className={styles.section} aria-labelledby="outcomes">
            <SectionHeading id="outcomes" title="What you’ll be able to do" description="Practical outcomes for stronger, evidence-led recruiting." />
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
              title="Course curriculum"
              description={`${total} lessons · ${course.duration} · Self-paced${purchased ? ` · ${done} of ${total} complete` : ''}`}
            />
            <ul className={styles.lessons}>
              {course.lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <LessonRow
                    number={index + 1}
                    title={lesson.title}
                    unlocked={purchased}
                    done={purchased && isLessonDone(course.id, lesson.id)}
                    onClick={() => (purchased ? toggleLesson(course.id, lesson.id) : setBuying(true))}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="details">
            <SectionHeading id="details" title="Course details" />
            <dl className={styles.details}>
              {[
                ['Specialist stream', course.stream],
                ['Experience level', course.level],
                ['Estimated time', course.duration],
                ['Designed for', course.designedFor],
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
            <p className={styles.priceLabel}>Course price</p>
            <p className={styles.priceValue}>{formatPrice(course.price)}</p>
            <p className={styles.access}>{course.access}</p>
            <ul className={styles.included}>
              {INCLUDED.map((item) => (
                <li key={item}>
                  <Icon as={Check} size={13} />
                  {item}
                </li>
              ))}
            </ul>
            {purchased ? (
              <Button variant="secondary" fullWidth disabled leftIcon={<Icon as={Check} size={13} />}>
                Purchased
              </Button>
            ) : (
              <Button fullWidth rightIcon={<Icon as={ArrowRight} size={13} />} onClick={() => setBuying(true)}>
                Buy Now
              </Button>
            )}
          </section>
          <section className={styles.accountability}>
            <Icon as={ShieldCheck} size={21} />
            <h2>Learning with accountability</h2>
            <p>Completion supports professional development. It does not replace organisational policy, legal advice, or human review of hiring decisions.</p>
          </section>
        </aside>
      </div>

      <PurchaseDialog
        course={buying ? course : null}
        onClose={() => setBuying(false)}
        onConfirm={() => {
          purchase(course.id)
          setBuying(false)
        }}
      />
    </div>
  )
}
