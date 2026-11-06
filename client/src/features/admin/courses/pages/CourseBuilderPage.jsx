import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CircleAlert, LockKeyhole } from 'lucide-react'
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
import { cx } from '@/utils/cx.js'
import builderStyles from '../components/builder.module.css'
import styles from './CourseBuilderPage.module.css'

const TABS = ['details', 'lessons', 'quiz', 'preview']
const STATUS_TONE = { published: 'success', draft: 'warning', unpublished: 'neutral' }
// The road from a title to a published course: this page, then the builder's tabs.
const NEW_STEPS = ['title', ...TABS]

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

  const backTo = audience === 'recruiter' ? '/admin/courses/recruiter' : '/admin/courses'

  return (
    <>
      <Link to={backTo} className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('builder.back')}
      </Link>
      <PageTitle eyebrow={t(`tabs.${audience}`)} title={t('builder.newTitle')} description={t('builder.newDescription')} />
      <div className={styles.newLayout}>
        <Panel padding={0} className={styles.newPanel}>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.newHead}>
              <div>
                <h2 className={styles.newHeading}>{t('builder.new.formTitle')}</h2>
                <p className={styles.newText}>{t('builder.new.formText')}</p>
              </div>
              <PillBadge tone={STATUS_TONE.draft} dot>
                {t('enums:courseStatus.draft')}
              </PillBadge>
            </div>
            <div className={styles.newBody}>
              <TextField
                label={t('details.title')}
                hint={t('builder.new.titleHint')}
                value={form.values.title}
                onChange={(event) => form.set('title', event.target.value)}
                error={errorText.field('title', form.errors.title)}
                autoFocus
              />
              {form.failure && (
                <p role="alert" className={styles.newFailure}>
                  {errorText.code(form.failure)}
                </p>
              )}
            </div>
            <div className={styles.newFooter}>
              <p className={styles.newNote}>{t('builder.new.draftNote')}</p>
              <div className={styles.newActions}>
                <Button as={Link} to={backTo} variant="secondary">
                  {t('builder.new.cancel')}
                </Button>
                <Button type="submit" loading={isLoading} rightIcon={<Icon as={ArrowRight} size={14} />}>
                  {t('builder.create')}
                </Button>
              </div>
            </div>
          </form>
        </Panel>

        <Panel padding={24} className={styles.stepsPanel}>
          <h2 className={styles.newHeading}>{t('builder.new.stepsTitle')}</h2>
          <ol className={styles.newSteps}>
            {NEW_STEPS.map((step, index) => (
              <li key={step} className={index === 0 ? styles.newStepCurrent : undefined} aria-current={index === 0 ? 'step' : undefined}>
                <span className={styles.newStepNumber}>{index + 1}</span>
                <div>
                  <p className={styles.newStepLabel}>
                    {step === 'title' ? t('details.title') : t(`builder.tab.${step}`)}
                    {index === 0 && <span className={styles.newHere}>{t('builder.new.here')}</span>}
                  </p>
                  <p className={styles.newStepText}>{t(`builder.new.steps.${step}`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  )
}

/** The builder tab where a publish problem is fixed. */
const problemTab = (field) => (field.startsWith('lessons') ? 'lessons' : field.startsWith('quiz') ? 'quiz' : 'details')

/**
 * After the tab has rendered, starts the fix for a publish problem: Add lesson, edit the lesson named, add a first
 * quiz question, choose the cover, or focus the Details field. `field` is the server's name (`lessons.2.videoFileId`).
 */
function goToFix(field) {
  const main = document.querySelector('main')
  if (!main) return
  const [root, index, name] = field.split('.')
  const show = (element, { click = false } = {}) => {
    if (!element) return
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (click) element.click()
    else element.focus({ preventScroll: true })
  }
  if (root === 'lessons') {
    if (name) show(main.querySelectorAll('[data-lesson-item]')[Number(index)]?.querySelector('button:not([data-move])'), { click: true })
    else show(main.querySelector('[data-add-lesson]'), { click: true })
  } else if (root === 'quiz') {
    if (!main.querySelector('[data-question]')) main.querySelector('[data-add-question]')?.click()
    window.setTimeout(() => show(main.querySelector('[data-question] input')))
  } else if (root === 'coverFileId') {
    show(main.querySelector('[data-upload="course_cover"] label'), { click: true })
  } else if (root === 'prices') {
    show(main.querySelector('input[data-price="EUR"]'))
  } else if (root === 'outcomes') {
    show(main.querySelector('[data-outcome="0"]'))
  } else {
    show(main.querySelector(`[name="${root}"]`))
  }
}

/**
 * The checklist of what still blocks publishing (U24), from the server's own publish rules: grouped by the tab that
 * fixes it, with the missing prices in one line.
 */
function Problems({ problems, currentTab, onOpenTab }) {
  function fix(tab, field) {
    onOpenTab(tab)
    window.setTimeout(() => goToFix(field))
  }

  const { t } = useTranslation('courses')
  const problemText = useProblemText()
  const entries = Object.entries(problems)
  if (!entries.length) return null

  const currencies = entries.filter(([field]) => field.startsWith('prices.')).map(([field]) => field.split('.')[1])
  const items = entries
    .filter(([field]) => currencies.length < 2 || !field.startsWith('prices.'))
    .map(([field, key]) => ({ field, text: problemText(field, key) }))
  if (currencies.length > 1) {
    const firstPrice = entries.findIndex(([field]) => field.startsWith('prices.'))
    items.splice(firstPrice, 0, { field: 'prices', text: t('problems.prices', { currencies: currencies.join(', ') }) })
  }
  const groups = TABS.map((tab) => ({ tab, items: items.filter((item) => problemTab(item.field) === tab) })).filter((group) => group.items.length)

  return (
    <Panel padding={0} className={cx(styles.problems, currentTab === 'details' && styles.problemsCompact)} data-publish-problems>
      <div className={styles.problemsHead}>
        <Icon as={CircleAlert} size={18} className={styles.problemsIcon} />
        <div>
          <h2 className={styles.problemsTitle}>{t('builder.problemsTitle')}</h2>
          <p className={styles.problemsText}>{t('builder.problemsText', { count: items.length })}</p>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.tab} className={styles.problemGroup}>
          <header className={styles.problemGroupHead}>
            <h3 className={styles.problemGroupTitle}>
              {t(`builder.tab.${group.tab}`)}
              <span className={styles.problemCount}>{group.items.length}</span>
            </h3>
            {group.tab !== currentTab && (
              <Button variant="ghost" size="sm" rightIcon={<Icon as={ArrowRight} size={13} />} onClick={() => onOpenTab(group.tab)}>
                {t('builder.problemsOpen', { tab: t(`builder.tab.${group.tab}`) })}
              </Button>
            )}
          </header>
          <ul className={styles.problemList}>
            {group.items.map((item) => (
              <li key={item.field}>
                <button type="button" className={styles.problemItem} onClick={() => fix(group.tab, item.field)}>
                  <span className={styles.problemCheck} aria-hidden="true" />
                  <span className={styles.problemItemText}>{item.text}</span>
                  <Icon as={ArrowRight} size={14} className={styles.problemArrow} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Panel>
  )
}

/** The builder's top bar: back, the audience and course name with its status, the tabs, and publishing. */
function EditorBar({ backTo, eyebrow, title, status, tabs, actions }) {
  const { t } = useTranslation('courses')
  return (
    <div className={styles.editorBar}>
      <div className={styles.editorTitle}>
        <Link to={backTo} className={styles.backButton} aria-label={t('builder.back')}>
          <Icon as={ArrowLeft} size={16} />
        </Link>
        <div className={styles.editorText}>
          <p className={styles.editorEyebrow}>{eyebrow}</p>
          <div className={styles.editorHeading}>
            <h1 className={styles.editorName}>{title}</h1>
            {status}
          </div>
        </div>
      </div>
      {tabs}
      <div className={styles.headerActions}>{actions}</div>
    </div>
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
      <SkeletonRegion>
        <EditorBar
          backTo="/admin/courses"
          eyebrow={<Skeleton width={96} />}
          title={<Skeleton width={240} height={22} />}
          status={<Skeleton shape="pill" width={64} />}
          tabs={<SegmentedTabs className={styles.barTabs} label={t('builder.tabsLabel')} tabs={TABS.map((id) => ({ id, label: t(`builder.tab.${id}`) }))} value={tab} onChange={onTabChange} />}
          actions={<Skeleton shape="pill" width={96} height={40} />}
        />
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
  // On Details the checklist sits in the side column beside the learner preview; elsewhere above the tab.
  const checklist = (publishFailed || course.status !== 'published') && <Problems problems={course.problems} currentTab={tab} onOpenTab={setTab} />
  return (
    <>
      <EditorBar
        backTo={listPath}
        eyebrow={t(`tabs.${course.audience}`)}
        title={course.title}
        status={
          <PillBadge tone={STATUS_TONE[course.status]} dot data-course-status={course.status}>
            {t(`enums:courseStatus.${course.status}`)}
          </PillBadge>
        }
        tabs={<SegmentedTabs className={styles.barTabs} label={t('builder.tabsLabel')} tabs={TABS.map((id) => ({ id, label: t(`builder.tab.${id}`) }))} value={tab} onChange={setTab} />}
        actions={
          course.status === 'published' ? (
            <Button variant="outline" loading={changing} onClick={() => changeStatus('unpublished')}>
              {t('builder.unpublish')}
            </Button>
          ) : (
            <Button loading={changing} onClick={() => changeStatus('published')} data-publish>
              {t('builder.publish')}
            </Button>
          )
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
      {tab !== 'details' && checklist}

      <div className={styles.panel}>
        {tab === 'details' && <DetailsTab course={course} checklist={checklist} />}
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
