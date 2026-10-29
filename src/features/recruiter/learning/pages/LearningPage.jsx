import { useMemo, useState } from 'react'
import { Award, CirclePlay, CircleHelp, GraduationCap, Layers, Search, Sparkles } from 'lucide-react'
import { Icon, SelectField, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import CourseCard from '../components/CourseCard.jsx'
import PurchaseDialog from '../components/PurchaseDialog.jsx'
import SuggestionCard from '../components/SuggestionCard.jsx'
import { SUGGESTIONS } from '../data/courses.js'
import { useRecruiterLearning } from '../hooks/useRecruiterLearning.js'
import styles from './LearningPage.module.css'

/** Recruiter learning: progress stats, AI course suggestions and the searchable course library. */
export default function LearningPage() {
  const { courses: catalogue, progress, purchase, inProgressCount, certificateCount } = useRecruiterLearning()
  const [query, setQuery] = useState('')
  const [stream, setStream] = useState('all')
  const [buying, setBuying] = useState(null)

  const streams = useMemo(() => [...new Set(catalogue.map((course) => course.stream))], [catalogue])
  const streamOptions = [{ value: 'all', label: 'All streams' }, ...streams.map((item) => ({ value: item, label: item }))]
  // A suggested course the admin has set to draft is left out.
  const suggestions = SUGGESTIONS.map((suggestion) => ({
    suggestion,
    course: catalogue.find((course) => course.id === suggestion.courseId),
  })).filter(({ course }) => course)

  const courses = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return catalogue.filter(
      (course) =>
        (stream === 'all' || course.stream === stream) &&
        (!needle || `${course.title} ${course.stream} ${course.level} ${course.summary}`.toLowerCase().includes(needle)),
    )
  }, [catalogue, query, stream])

  return (
    <div>
      <PageTitle
        eyebrow="Recruiter academy"
        title="Grow your expertise. Hire with greater confidence."
        description="Explore practical learning for Enterprise SaaS, specialist recruitment, fair hiring, interviewing, and talent leadership."
        actions={
          <PillBadge tone="accent">
            <Icon as={GraduationCap} size={12} />
            Learning profile active
          </PillBadge>
        }
      />

      <div className={styles.stats}>
        <StatCard label="Courses in progress" value={inProgressCount} caption="Continue from your last lesson" icon={CirclePlay} />
        <StatCard label="Certificates earned" value={certificateCount} caption="Completed knowledge checks" icon={Award} />
        <StatCard label="Specialist streams" value={streams.length} caption="Role and industry-focused learning" icon={Layers} />
      </div>

      <section className={styles.suggestions} aria-labelledby="ai-suggestions">
        <div className={styles.suggestionsHead}>
          <div>
            <p className={styles.eyebrow}>
              <Icon as={Sparkles} size={13} />
              AI course suggestions
            </p>
            <h2 className={styles.suggestionsTitle} id="ai-suggestions">
              Recommended for you
            </h2>
          </div>
          <div className={styles.tags}>
            <PillBadge tone="neutral">Enterprise SaaS</PillBadge>
            <PillBadge tone="neutral">3 active roles</PillBadge>
          </div>
        </div>
        <div className={styles.suggestionGrid}>
          {suggestions.map(({ suggestion, course }) => (
            <SuggestionCard key={suggestion.courseId} suggestion={suggestion} course={course} />
          ))}
        </div>
        <p className={styles.aiNote}>
          <Icon as={CircleHelp} size={12} />
          Suggestions use your company profile, active roles, hiring activity, and learning progress. No connected AI model is used.
        </p>
      </section>

      <div className={styles.filters}>
        <TextField
          className={styles.search}
          type="search"
          aria-label="Search recruiter learning"
          placeholder="Search skills, topics, or recruiting streams"
          leftIcon={<Icon as={Search} size={15} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField
          className={styles.stream}
          aria-label="Filter by specialist stream"
          options={streamOptions}
          value={stream}
          onChange={(event) => setStream(event.target.value)}
        />
      </div>

      <section className={styles.library} aria-labelledby="learning-library">
        <SectionHeading id="learning-library" title="Learning library" description={`${catalogue.length} practical courses with guided lessons and knowledge checks.`} />
        <div className={styles.grid}>
          {courses.length === 0 ? (
            <div className={styles.empty}>
              <EmptyState icon={Search} title="No courses match" description="Try a different search or choose another specialist stream." />
            </div>
          ) : (
            courses.map((course) => <CourseCard key={course.id} course={course} progress={progress(course)} onBuy={() => setBuying(course)} />)
          )}
        </div>
      </section>

      <p className={styles.notice}>
        Recruiter learning progress and certificates are local prototype states saved in this browser. Courses provide professional-development guidance and do not replace company policy or jurisdiction-specific legal advice.
      </p>

      <PurchaseDialog
        course={buying}
        onClose={() => setBuying(null)}
        onConfirm={(course) => {
          purchase(course.id)
          setBuying(null)
        }}
      />
    </div>
  )
}
