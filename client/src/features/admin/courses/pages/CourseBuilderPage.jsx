import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, LockKeyhole } from 'lucide-react'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { Button, Icon, Panel, Skeleton, SkeletonRegion, TextField } from '@/components/ui'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useCreateCourseMutation, useGetAdminCourseQuery, useSetCourseStatusMutation } from '../api.js'
import DetailsTab from '../components/DetailsTab.jsx'
import LessonsTab from '../components/LessonsTab.jsx'
import PreviewTab from '../components/PreviewTab.jsx'
import QuizTab from '../components/QuizTab.jsx'
import { useProblemText } from '../problems.js'
import builderStyles from '../components/builder.module.css'
import styles from './CourseBuilderPage.module.css'

const TABS = ['details', 'lessons', 'quiz', 'preview']
const STATUS_TONE = { published: 'success', draft: 'warning', unpublished: 'neutral' }

/** /admin/courses/new?audience=: a draft needs only its title; the builder opens once it exists (M-101). */
function NewCourse() {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const audience = searchParams.get('audience') === 'recruiter' ? 'recruiter' : 'candidate'
  const [create, { isLoading }] = useCreateCourseMutation()
  const form = useFormState({ title: '' })

  async function handleSubmit(event) {
    event.preventDefault()
    let id
    const ok = await form.run({}, async () => {
      id = (await create({ audience, title: form.values.title }).unwrap()).id
    })
    if (ok) navigate(`/admin/courses/${id}/edit`, { replace: true })
  }

  return (
    <>
      <Link to={audience === 'recruiter' ? '/admin/courses/recruiter' : '/admin/courses'} className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('builder.back')}
      </Link>
      <PageTitle eyebrow={t(`tabs.${audience}`)} title={t('builder.newTitle')} description={t('builder.newDescription')} />
      <Panel padding={24} className={styles.newPanel}>
        <form onSubmit={handleSubmit} noValidate className={styles.newForm}>
          <TextField label={t('details.title')} value={form.values.title} onChange={(event) => form.set('title', event.target.value)} error={errorText.field('title', form.errors.title)} autoFocus />
          {form.failure && <p role="alert">{errorText.code(form.failure)}</p>}
          <Button type="submit" loading={isLoading}>
            {t('builder.create')}
          </Button>
        </form>
      </Panel>
    </>
  )
}

/** The checklist of what still blocks publishing (U24), from the server's own publish rules. */
function Problems({ problems }) {
  const { t } = useTranslation('courses')
  const problemText = useProblemText()
  const entries = Object.entries(problems)
  if (!entries.length) return null
  return (
    <Panel padding={20} className={styles.problems} data-publish-problems>
      <h2 className={styles.problemsTitle}>{t('builder.problemsTitle')}</h2>
      <ul>
        {entries.map(([field, key]) => (
          <li key={field}>
            <Icon as={CircleAlert} size={14} />
            <span>{problemText(field, key)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** The builder while the course loads: its heading, status and publish action, the tabs and the Details fields. */
function BuilderSkeleton({ tab, onTabChange }) {
  const { t } = useTranslation('courses')
  // [field, wide, control height]; the second text area's label depends on the audience, so it stays a placeholder.
  const fields = [
    ['title', false, 44],
    ['category', false, 44],
    ['level', false, 44],
    ['language', false, 44],
    ['summary', true, 120],
    [null, true, 120],
  ]
  return (
    <>
      <Link to="/admin/courses" className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('builder.back')}
      </Link>
      <SkeletonRegion>
        <PageTitle
          eyebrow={<Skeleton width={96} />}
          title={<Skeleton width={320} height={28} />}
          description={t('builder.description')}
          actions={
            <div className={styles.headerActions}>
              <Skeleton shape="pill" width={80} />
              <Skeleton shape="pill" width={96} height={40} />
            </div>
          }
        />
        <SegmentedTabs className={styles.tabs} label={t('builder.tabsLabel')} tabs={TABS.map((id) => ({ id, label: t(`builder.tab.${id}`) }))} value={tab} onChange={onTabChange} />
        <div className={styles.panel}>
          <Panel padding={24} className={builderStyles.grid}>
            {fields.map(([name, wide, height], index) => (
              <div key={index} className={wide ? `${styles.skeletonField} ${builderStyles.wide}` : styles.skeletonField}>
                <span className={styles.skeletonLabel}>{name ? t(`details.${name}`) : <Skeleton width={120} height={12} />}</span>
                <Skeleton shape="block" height={height} className={styles.skeletonControl} />
              </div>
            ))}
          </Panel>
        </div>
      </SkeletonRegion>
    </>
  )
}

/** /admin/courses/:courseId/edit: the full-page builder with tabs Details, Lessons, Quiz and Preview (M-101). */
function Builder({ courseId }) {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const [searchParams] = useSearchParams()
  const { data: course, error: loadError, isLoading } = useGetAdminCourseQuery(courseId)
  const [setStatus, { isLoading: changing }] = useSetCourseStatusMutation()
  const [tab, setTab] = useState('details')
  // Arriving from the list after a refused publish shows the reasons at once.
  const [publishFailed, setPublishFailed] = useState(searchParams.get('publish') === '1')
  const [failure, setFailure] = useState(null)

  if (loadError) return <NoticeBanner>{errorText.code(loadError)}</NoticeBanner>
  if (isLoading) return <BuilderSkeleton tab={tab} onTabChange={setTab} />
  if (!course) return null

  async function changeStatus(status) {
    setFailure(null)
    try {
      await setStatus({ id: course.id, status }).unwrap()
      setPublishFailed(false)
    } catch (error) {
      if (error?.data?.error?.code === 'VALIDATION_FAILED') {
        setPublishFailed(true)
        setTab(error.data.error.params?.tab ?? 'details')
      } else setFailure(error)
    }
  }

  const listPath = course.audience === 'recruiter' ? '/admin/courses/recruiter' : '/admin/courses'
  return (
    <>
      <Link to={listPath} className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('builder.back')}
      </Link>
      <PageTitle
        eyebrow={t(`tabs.${course.audience}`)}
        title={course.title}
        description={t('builder.description')}
        actions={
          <div className={styles.headerActions}>
            <PillBadge tone={STATUS_TONE[course.status]} dot data-course-status={course.status}>
              {t(`enums:courseStatus.${course.status}`)}
            </PillBadge>
            {course.status === 'published' ? (
              <Button variant="outline" loading={changing} onClick={() => changeStatus('unpublished')}>
                {t('builder.unpublish')}
              </Button>
            ) : (
              <Button loading={changing} onClick={() => changeStatus('published')} data-publish>
                {t('builder.publish')}
              </Button>
            )}
          </div>
        }
      />

      {course.locked && (
        <NoticeBanner>
          <span className={styles.lock} data-locked-notice>
            <Icon as={LockKeyhole} size={14} />
            {t('builder.locked')}
          </span>
        </NoticeBanner>
      )}
      {failure && <NoticeBanner>{errorText.code(failure)}</NoticeBanner>}
      {(publishFailed || course.status !== 'published') && <Problems problems={course.problems} />}

      <SegmentedTabs className={styles.tabs} label={t('builder.tabsLabel')} tabs={TABS.map((id) => ({ id, label: t(`builder.tab.${id}`) }))} value={tab} onChange={setTab} />

      <div className={styles.panel}>
        {tab === 'details' && <DetailsTab course={course} />}
        {tab === 'lessons' && <LessonsTab course={course} />}
        {tab === 'quiz' && <QuizTab course={course} />}
        {tab === 'preview' && <PreviewTab course={course} />}
      </div>
    </>
  )
}

export default function CourseBuilderPage() {
  const { courseId } = useParams()
  return courseId ? <Builder key={courseId} courseId={courseId} /> : <NewCourse />
}
