import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, CirclePlay, GraduationCap, ShieldCheck } from 'lucide-react'
import { Button, Icon, Modal, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import LessonRow from '../components/LessonRow.jsx'
import PurchaseDialog from '../components/PurchaseDialog.jsx'
import { findCourse } from '../data/courses.js'
import { formatPrice, useLearning } from '../hooks/useLearning.js'
import styles from './LearningDetailsPage.module.css'

const INCLUDED = ['pre-recorded lessons', 'Completion assessment', 'Course-completion badge', 'Learn at your own pace']

/** Course details: free introduction, outcomes, curriculum with lesson completion, price and progress. */
export default function LearningDetailsPage() {
  const { courseId } = useParams()
  const course = findCourse(courseId)
  const learning = useLearning()
  const [buying, setBuying] = useState(null)
  const [introOpen, setIntroOpen] = useState(false)
  const [message, setMessage] = useState('')

  if (!course) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="This course does not exist"
        description="The course may have been renamed or removed. Choose one from the catalogue."
        action={
          <Button as={Link} to="/candidate/learning">
            Back to learning
          </Button>
        }
      />
    )
  }

  const progress = learning.progress(course)
  const completedIds = learning.state.completedLessons[course.id] ?? []
  const lessonCount = course.lessons.length

  function confirmPurchase() {
    learning.purchase(course.id)
    setBuying(null)
    setMessage('Course purchased. The lessons are now unlocked.')
  }

  return (
    <>
      <Link to="/candidate/learning" className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        Back to learning
      </Link>

      <PageTitle
        eyebrow={`${course.category} · ${course.level}`}
        title={course.title}
        description={course.summary}
        actions={
          progress.complete ? (
            <PillBadge tone="success">Completed</PillBadge>
          ) : progress.purchased ? (
            <PillBadge tone="warning">Purchased</PillBadge>
          ) : null
        }
      />

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.hero} aria-labelledby="intro-heading">
            <div className={styles.heroTop}>
              <PillBadge tone="info">Free introduction · 3 min</PillBadge>
              <Icon as={BookOpen} size={22} />
            </div>
            <h2 className={styles.heroTitle} id="intro-heading">
              Preview the course before you decide.
            </h2>
            <p className={styles.heroText}>
              Meet the course, understand the practical project, and see how the lessons support your {course.category}{' '}
              development. No purchase is needed for this introduction.
            </p>
            <Button leftIcon={<Icon as={CirclePlay} size={15} />} onClick={() => setIntroOpen(true)}>
              Watch free introduction
            </Button>
          </section>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>What you’ll learn</h2>
            <p className={styles.sectionLead}>Practical outcomes designed around evidence, reflection, and application.</p>
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
            <h2 className={styles.sectionTitle}>Course curriculum</h2>
            <p className={styles.sectionLead}>
              Free introduction + {lessonCount} lessons · {course.duration} · Learn at your pace
            </p>
            <div className={styles.lessons}>
              <LessonRow kind="intro" title="Course introduction" subtitle="Preview · 3 minutes" onClick={() => setIntroOpen(true)} />
              {course.lessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  kind="lesson"
                  title={`${index + 1}. ${lesson.title}`}
                  subtitle="Pre-recorded lesson"
                  unlocked={progress.purchased}
                  done={completedIds.includes(lesson.id)}
                  onClick={() => learning.toggleLesson(course.id, lesson.id)}
                />
              ))}
            </div>
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>About this course</h2>
            <p className={styles.about}>{course.about}</p>
            <ul className={styles.tags}>
              <li>
                <PillBadge>{course.level}</PillBadge>
              </li>
              <li>
                <PillBadge>{course.duration}</PillBadge>
              </li>
              <li>
                <PillBadge>{lessonCount} lessons</PillBadge>
              </li>
              <li>
                <PillBadge tone="accent">{course.category}</PillBadge>
              </li>
            </ul>
          </Panel>
        </div>

        <aside className={styles.side}>
          <Panel padding={24}>
            <p className={styles.priceLabel}>Course price</p>
            <p className={styles.price}>{formatPrice(course.price)}</p>
            <p className={styles.access}>One-time course access</p>
            <ul className={styles.included}>
              {INCLUDED.map((item, index) => (
                <li key={item}>
                  <Icon as={Check} size={13} />
                  {index === 0 ? `${lessonCount} ${item}` : item}
                </li>
              ))}
            </ul>
            {progress.purchased ? (
              <Button fullWidth disabled className={styles.purchased}>
                Purchased
              </Button>
            ) : (
              <Button fullWidth rightIcon={<Icon as={ArrowRight} size={13} />} onClick={() => setBuying(course)}>
                Buy Now
              </Button>
            )}
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>Your progress</h2>
            <p className={styles.percent}>{progress.percent}%</p>
            <div
              className={styles.track}
              role="progressbar"
              aria-label="Course completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <span className={styles.fill} style={{ width: `${progress.percent}%` }} />
            </div>
            <p className={styles.progressText} aria-live="polite">
              {progress.done} of {progress.total} lessons complete
            </p>
          </Panel>

          <section className={styles.evidence}>
            <Icon as={ShieldCheck} size={21} className={styles.evidenceIcon} />
            <h2 className={styles.evidenceTitle}>Evidence, not a shortcut.</h2>
            <p className={styles.evidenceText}>
              Completion confirms participation and a short knowledge check. It does not verify workplace proficiency or
              change your profile skills automatically.
            </p>
          </section>
        </aside>
      </div>

      <PurchaseDialog course={buying} onConfirm={confirmPurchase} onClose={() => setBuying(null)} />
      <Modal
        open={introOpen}
        onClose={() => setIntroOpen(false)}
        title="Course introduction"
        description={`${course.title} · Preview · 3 minutes`}
        footer={
          <Button variant="secondary" onClick={() => setIntroOpen(false)}>
            Close
          </Button>
        }
      >
        <p className={styles.introNote}>
          This prototype does not include video playback. In the full product, the free 3-minute introduction would play
          here, with no purchase needed.
        </p>
      </Modal>
    </>
  )
}
