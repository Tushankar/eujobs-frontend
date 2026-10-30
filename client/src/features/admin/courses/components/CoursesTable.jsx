import DataTable from '@/components/common/DataTable.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import { formatPrice, formatUpdated } from '../utils/courseFormat.js'
import styles from './CoursesTable.module.css'

/**
 * Course list with per-row Manage (opens the edit dialog) and Publish / Unpublish.
 * `accentActions` paints both row actions in the primary blue (the Recruiter courses frame).
 */
export default function CoursesTable({ courses, accentActions = false, onManage, onToggleStatus }) {
  const columns = [
    {
      key: 'course',
      header: 'Course',
      width: 256,
      render: (course) => (
        <>
          <p className={styles.title}>{course.title}</p>
          <p className={styles.meta}>
            {course.category} · {course.lessons} lessons
          </p>
        </>
      ),
    },
    { key: 'level', header: 'Level', width: 114, render: (course) => <span className={styles.muted}>{course.level}</span> },
    {
      key: 'access',
      header: 'Access',
      width: 98,
      render: (course) => <PillBadge tone={course.price > 0 ? 'warning' : 'neutral'}>{formatPrice(course.price)}</PillBadge>,
    },
    {
      key: 'learning',
      header: 'Learning',
      width: 186,
      render: (course) => (
        <span className={styles.muted}>
          {course.enrolled} enrolled · {course.purchased} purchased
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 111,
      render: ({ status }) =>
        status === 'published' ? (
          <PillBadge tone="success" dot>
            Published
          </PillBadge>
        ) : (
          <PillBadge tone="warning" dot>
            Draft
          </PillBadge>
        ),
    },
    { key: 'updated', header: 'Updated', width: 125, render: (course) => <span className={styles.muted}>{formatUpdated(course.updatedAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (course) => (
        <div className={styles.actions}>
          <Button variant="ghost" className={styles.manage} onClick={() => onManage(course)} aria-label={`Manage ${course.title}`}>
            Manage
          </Button>
          <Button
            variant="outline"
            className={styles.toggle}
            onClick={() => onToggleStatus(course)}
            aria-label={`${course.status === 'published' ? 'Unpublish' : 'Publish'} ${course.title}`}
          >
            {course.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable className={cx(styles.table, accentActions && styles.accent)} columns={columns} rows={courses} getRowKey={(course) => course.id} caption="Courses" />
  )
}
