import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DataTable from '@/components/common/DataTable.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './CoursesTable.module.css'

const STATUS_TONE = { published: 'success', draft: 'warning', unpublished: 'neutral' }

/**
 * Course list: Manage opens the builder (M-101); Publish runs the server's publish checks (U24) and Unpublish hides
 * the course (M-109). `accentActions` paints both row actions in the primary blue (the Recruiter courses frame).
 */
export default function CoursesTable({ courses, accentActions = false, onToggleStatus }) {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const columns = [
    {
      key: 'course',
      header: t('table.course'),
      width: 256,
      render: (course) => (
        <>
          <p className={styles.title}>{course.title}</p>
          <p className={styles.meta}>{[course.category, t('table.lessons', { count: course.lessons }), course.durationSec > 0 && format.duration(course.durationSec)].filter(Boolean).join(' · ')}</p>
        </>
      ),
    },
    { key: 'level', header: t('table.level'), width: 114, render: (course) => <span className={styles.muted}>{course.level ? t(`enums:courseLevel.${course.level}`) : '—'}</span> },
    {
      key: 'access',
      header: t('table.access'),
      width: 98,
      render: (course) => (
        <PillBadge tone={course.isFree ? 'neutral' : 'warning'}>
          {course.isFree ? t('table.free') : course.price ? format.money(course.price.amountMinor, course.price.currency) : t('table.paid')}
        </PillBadge>
      ),
    },
    {
      key: 'learning',
      header: t('table.learning'),
      width: 186,
      render: (course) => <span className={styles.muted}>{t('table.learners', { enrolled: course.enrolled, purchased: course.purchased })}</span>,
    },
    {
      key: 'status',
      header: t('table.status'),
      width: 111,
      render: ({ status }) => (
        <PillBadge tone={STATUS_TONE[status]} dot>
          {t(`enums:courseStatus.${status}`)}
        </PillBadge>
      ),
    },
    { key: 'updated', header: t('table.updated'), width: 125, render: (course) => <span className={styles.muted}>{format.date(course.updatedAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('table.actions')}</span>,
      render: (course) => (
        <div className={styles.actions}>
          <Button as={Link} to={`/admin/courses/${course.id}/edit`} variant="ghost" className={styles.manage} aria-label={t('table.manageLabel', { title: course.title })}>
            {t('table.manage')}
          </Button>
          <Button
            variant="outline"
            className={styles.toggle}
            onClick={() => onToggleStatus(course)}
            aria-label={t(course.status === 'published' ? 'table.unpublishLabel' : 'table.publishLabel', { title: course.title })}
          >
            {t(course.status === 'published' ? 'table.unpublish' : 'table.publish')}
          </Button>
        </div>
      ),
    },
  ]

  return <DataTable className={cx(styles.table, accentActions && styles.accent)} columns={columns} rows={courses} getRowKey={(course) => course.id} caption={t('table.caption')} />
}
