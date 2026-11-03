import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, BriefcaseBusiness, CircleCheck, GraduationCap, Lock, Plus, Search, Users } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import { useGetConfigQuery } from '@/app/api.js'
import { useErrorText } from '@/lib/forms.js'
import { cx } from '@/utils/cx.js'
import { useGetAdminCoursesQuery, useSetCourseStatusMutation } from '../api.js'
import CoursesTable from '../components/CoursesTable.jsx'
import styles from './CoursesPage.module.css'

/**
 * Admin course catalogue (§3.9). "Candidate courses" (/admin/courses) and "Recruiter courses" (/admin/courses/recruiter)
 * are two audience tabs. The numbers are real (M-110): active learners have at least one lesson done and no completion.
 */
export default function CoursesPage() {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const navigate = useNavigate()
  const audience = useLocation().pathname.endsWith('/recruiter') ? 'recruiter' : 'candidate'
  const { data: config } = useGetConfigQuery()
  const { data } = useGetAdminCoursesQuery(audience)
  const [setStatus] = useSetCourseStatusMutation()
  const [query, setQuery] = useState('')
  const [status, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')

  const courses = data?.items ?? []
  const needle = query.trim().toLocaleLowerCase()
  const visible = courses.filter((course) => (status === 'all' || course.status === status) && [course.title, course.category].some((text) => text.toLocaleLowerCase().includes(needle)))
  const tabs = [
    { id: 'candidate', label: t('tabs.candidate'), icon: Users, iconSize: 15 },
    { id: 'recruiter', label: t('tabs.recruiter'), icon: BriefcaseBusiness, iconSize: 15 },
  ]
  const statusOptions = [{ value: 'all', label: t('filters.allStatuses') }, ...(config?.enums.courseStatus ?? []).map((value) => ({ value, label: t(`enums:courseStatus.${value}`) }))]

  async function handleToggleStatus(course) {
    const next = course.status === 'published' ? 'unpublished' : 'published'
    try {
      await setStatus({ id: course.id, status: next }).unwrap()
      setNotice(t(next === 'published' ? 'notice.published' : 'notice.unpublished', { title: course.title }))
    } catch (error) {
      // A refused publish names its reasons in the builder (U24).
      if (error?.data?.error?.code === 'VALIDATION_FAILED') navigate(`/admin/courses/${course.id}/edit?publish=1`)
      else setNotice(errorText.code(error))
    }
  }

  return (
    <>
      <PageTitle
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
        actions={
          <Button as={Link} to={`/admin/courses/new?audience=${audience}`} leftIcon={<Icon as={Plus} size={14} />}>
            {t('page.create')}
          </Button>
        }
      />

      <ViewToggle
        className={styles.tabs}
        variant="wide"
        label={t('tabs.label')}
        items={tabs}
        value={audience}
        onChange={(next) => {
          setNotice('')
          navigate(workspacePath(WORKSPACES.admin, next === 'recruiter' ? 'courses/recruiter' : 'courses'))
        }}
      />

      <div className={styles.stats}>
        <StatCard label={t('stats.total')} value={data?.stats.total ?? 0} caption={t('stats.totalCaption')} icon={BookOpen} />
        <StatCard label={t('stats.published')} value={data?.stats.published ?? 0} caption={t(`stats.publishedCaption.${audience}`)} icon={CircleCheck} />
        <StatCard label={t('stats.paid')} value={data?.stats.paid ?? 0} caption={t('stats.paidCaption')} icon={Lock} />
        <StatCard label={t('stats.active')} value={data?.stats.activeLearners ?? 0} caption={t('stats.activeCaption')} icon={GraduationCap} />
      </div>

      <div className={styles.filters}>
        <TextField className={styles.search} type="search" aria-label={t('filters.search')} placeholder={t('filters.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
        <SelectField className={styles.status} aria-label={t('filters.status')} value={status} onChange={(event) => setStatusFilter(event.target.value)} options={statusOptions} />
      </div>

      {notice && <NoticeBanner>{notice}</NoticeBanner>}

      <div className={cx(styles.results, audience === 'recruiter' && styles.recruiterResults)}>
        {visible.length > 0 ? (
          <CoursesTable courses={visible} accentActions={audience === 'recruiter'} onToggleStatus={handleToggleStatus} />
        ) : (
          <EmptyState icon={Search} title={t('empty.title')} description={t('empty.text')} />
        )}
      </div>
    </>
  )
}
