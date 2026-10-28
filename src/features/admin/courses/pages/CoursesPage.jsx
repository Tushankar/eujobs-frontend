import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, BriefcaseBusiness, CircleCheck, GraduationCap, Lock, Search, Upload, Users } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import CourseFormModal from '../components/CourseFormModal.jsx'
import CoursesTable from '../components/CoursesTable.jsx'
import { AUDIENCES, STATUS_OPTIONS } from '../data/courses.js'
import { useCourses } from '../hooks/useCourses.js'
import { cx } from '@/utils/cx.js'
import styles from './CoursesPage.module.css'

const TABS = [
  { id: 'candidate', label: AUDIENCES.candidate.label, icon: Users, iconSize: 15 },
  { id: 'recruiter', label: AUDIENCES.recruiter.label, icon: BriefcaseBusiness, iconSize: 15 },
]

/**
 * Admin course catalogue. "Candidate courses" (/admin/courses) and "Recruiter courses"
 * (/admin/courses/recruiter) are two audience tabs of this page; both read the same persisted list.
 */
export default function CoursesPage() {
  const { courses, saveCourse, setStatus } = useCourses()
  const navigate = useNavigate()
  const audience = useLocation().pathname.endsWith('/recruiter') ? 'recruiter' : 'candidate'
  const [query, setQuery] = useState('')
  const [status, setStatusFilter] = useState('all')
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState('')

  const audienceCourses = courses.filter((course) => course.audience === audience)
  const needle = query.trim().toLowerCase()
  const visible = audienceCourses.filter(
    (course) =>
      (status === 'all' || course.status === status) &&
      [course.title, course.category].some((text) => text.toLowerCase().includes(needle)),
  )

  const published = audienceCourses.filter((course) => course.status === 'published').length
  const paid = audienceCourses.filter((course) => course.price > 0).length
  const learners = audienceCourses.reduce((total, course) => total + course.enrolled, 0)

  function handleSave(values) {
    saveCourse(values, dialog.course?.id)
    setNotice(dialog.course ? `Saved changes to "${values.title}".` : `Uploaded "${values.title}" to ${AUDIENCES[audience].label.toLowerCase()}.`)
    setDialog(null)
  }

  function handleToggleStatus(course) {
    const next = course.status === 'published' ? 'draft' : 'published'
    setStatus(course.id, next)
    setNotice(`${next === 'published' ? 'Published' : 'Unpublished'} "${course.title}".`)
  }

  return (
    <>
      <PageTitle
        eyebrow="Learning administration"
        title="Build learning with a clear purpose."
        description="Create, review, publish, and maintain the courses candidates see in their learning workspace."
        actions={
          <Button leftIcon={<Icon as={Upload} size={14} />} onClick={() => setDialog({ course: null })}>
            Upload course
          </Button>
        }
      />

      <ViewToggle
        className={styles.tabs}
        variant="wide"
        label="Course audience"
        items={TABS}
        value={audience}
        onChange={(next) => {
          setNotice('')
          navigate(workspacePath(WORKSPACES.admin, next === 'recruiter' ? 'courses/recruiter' : 'courses'))
        }}
      />

      <div className={styles.stats}>
        <StatCard label="Total courses" value={audienceCourses.length} caption="Draft and published content" icon={BookOpen} />
        <StatCard
          label="Published"
          value={published}
          caption={`Visible in ${AUDIENCES[audience].visibleIn}`}
          icon={CircleCheck}
        />
        <StatCard label="Paid courses" value={paid} caption="One-time purchase content" icon={Lock} />
        <StatCard label="Active learners" value={learners} caption="Course enrollments in this demo" icon={GraduationCap} />
      </div>

      <div className={styles.filters}>
        <TextField
          className={styles.search}
          type="search"
          aria-label="Search course or skill"
          placeholder="Search course or skill"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField
          className={styles.status}
          aria-label="Filter course status"
          value={status}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={STATUS_OPTIONS}
        />
      </div>

      {notice && <NoticeBanner>{notice}</NoticeBanner>}

      <div className={cx(styles.results, audience === 'recruiter' && styles.recruiterResults)}>
        {visible.length > 0 ? (
          <CoursesTable courses={visible} accentActions={audience === 'recruiter'} onManage={(course) => setDialog({ course })} onToggleStatus={handleToggleStatus} />
        ) : (
          <EmptyState icon={Search} title="No courses match your filters" description="Try a different search or choose All statuses." />
        )}
      </div>

      <p className={styles.note}>
        Course media is represented by its selected file name in this local prototype. File contents are not uploaded or retained.
        Production requires secure media storage, processing, access control, and delivery.
      </p>

      {dialog && (
        <CourseFormModal audience={audience} course={dialog.course} onClose={() => setDialog(null)} onSave={handleSave} />
      )}
    </>
  )
}
