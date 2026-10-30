import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, CirclePlay, Sparkles } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import CourseCard from '../components/CourseCard.jsx'
import LevelTabs from '../components/LevelTabs.jsx'
import PurchaseDialog from '../components/PurchaseDialog.jsx'
import { GAP_SKILL, LEVELS, SKILLS_TO_EXPLORE } from '../data/courses.js'
import { useLearning } from '../hooks/useLearning.js'
import styles from './LearningPage.module.css'

/** "Learning": stats, courses suggested for the skill gap, and the full catalogue filtered by level. */
export default function LearningPage() {
  const learning = useLearning()
  const [level, setLevel] = useState('All levels')
  const [buying, setBuying] = useState(null)
  const [message, setMessage] = useState('')

  const gapCourses = learning.courses.filter((course) => course.recommended)
  const visible = level === 'All levels' ? learning.courses : learning.courses.filter((course) => course.level === level)

  function confirmPurchase(course) {
    learning.purchase(course.id)
    setBuying(null)
    setMessage(`${course.title} is now in your learning. Open it to start the lessons.`)
  }

  function renderCard(course, recommended) {
    return (
      <CourseCard
        key={course.id}
        course={course}
        recommended={recommended}
        progress={learning.progress(course)}
        onBuy={() => setBuying(course)}
      />
    )
  }

  return (
    <>
      <PageTitle
        eyebrow="Learn with purpose"
        title="Build the skills behind your next move."
        description="Courses connected to real role gaps, with practical lessons, short assessments, and completion badges you control."
        actions={<PillBadge tone="accent">Learning Plus active</PillBadge>}
      />

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <div className={styles.stats}>
        <StatCard
          label="Courses in progress"
          value={learning.inProgressCount}
          caption="Continue whenever it suits you"
          icon={CirclePlay}
        />
        <StatCard
          label="Completion badges"
          value={learning.completedCount}
          caption="Kept separate from profile skills"
          icon={Award}
        />
        <StatCard
          label="Skills to explore"
          value={SKILLS_TO_EXPLORE}
          caption="Based on gaps in current roles"
          icon={Sparkles}
        />
      </div>

      <section className={styles.section} aria-labelledby="gap-courses-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle} id="gap-courses-heading">
              Courses for {GAP_SKILL}
            </h2>
            <p className={styles.sectionLead}>
              Suggested because these skills appear in current roles but not in your reviewed profile.
            </p>
          </div>
          <Link to="/candidate/ai-insights/skill-gap" className={styles.sectionLink}>
            Review gap evidence
          </Link>
        </div>
        <div className={styles.grid}>{gapCourses.map((course) => renderCard(course, true))}</div>
      </section>

      <section className={styles.explore} aria-labelledby="all-courses-heading">
        <h2 className={styles.sectionTitle} id="all-courses-heading">
          Explore all courses
        </h2>
        <p className={styles.sectionLead}>Choose a level that matches your experience and learning goal.</p>
        <div className={styles.tabs}>
          <LevelTabs levels={LEVELS} value={level} onChange={setLevel} />
        </div>
        <div className={styles.grid}>{visible.map((course) => renderCard(course, false))}</div>
      </section>

      <p className={styles.note}>
        Learning Plus is a local prototype state. No payment method is requested, no subscription is created, and
        course progress is saved only in this browser.
      </p>

      <PurchaseDialog course={buying} onConfirm={confirmPurchase} onClose={() => setBuying(null)} />
    </>
  )
}
