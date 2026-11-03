import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ExternalLink, FileText, LockKeyhole } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { errorCode } from '@/app/api.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetLessonQuery } from '../api.js'
import { useLearningPath } from '../useCourseText.js'
import styles from './LessonPage.module.css'

/** The lesson's content by type (M-102): a streamed video, sanitised text, an embedded PDF or an external link. */
function LessonContent({ lesson }) {
  const { t } = useTranslation('learning')
  if (lesson.type === 'video') {
    return <video className={styles.video} src={lesson.media.url} controls preload="metadata" data-lesson-video />
  }
  if (lesson.type === 'text') return <div className={styles.text} data-lesson-text dangerouslySetInnerHTML={{ __html: lesson.html }} />
  if (lesson.type === 'document') {
    return (
      <div className={styles.document}>
        <iframe className={styles.pdf} src={lesson.media.url} title={lesson.title} data-lesson-pdf />
        <Button as="a" href={lesson.media.url} target="_blank" rel="noopener" variant="outline" leftIcon={<Icon as={FileText} size={14} />}>
          {t('lesson.openPdf')}
        </Button>
      </div>
    )
  }
  return (
    <div className={styles.link}>
      <p>{t('lesson.linkIntro')}</p>
      <p className={styles.url}>{lesson.url}</p>
      <Button as="a" href={lesson.url} target="_blank" rel="noopener noreferrer" leftIcon={<Icon as={ExternalLink} size={14} />} data-lesson-link>
        {t('lesson.openLink')}
      </Button>
    </div>
  )
}

/** /…/learning/:courseId/lessons/:lessonId: one lesson, with the previous and next lessons (M-106: previews open without buying). */
export default function LessonPage() {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const { courseId, lessonId } = useParams()
  const base = useLearningPath()
  const { data: lesson, error } = useGetLessonQuery({ courseId, lessonId })
  const coursePath = `${base}/${courseId}`
  const back = (
    <Link to={coursePath} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('lesson.back')}
    </Link>
  )

  if (error) {
    const locked = errorCode(error) === 'FORBIDDEN'
    return (
      <>
        {back}
        <EmptyState
          icon={LockKeyhole}
          title={t(locked ? 'lesson.lockedTitle' : 'lesson.missingTitle')}
          description={t(locked ? 'lesson.lockedText' : 'lesson.missingText')}
          action={<Button as={Link} to={coursePath}>{t('lesson.toCourse')}</Button>}
        />
      </>
    )
  }
  if (!lesson) return back

  const step = (id, label, icon, side) =>
    id && (
      <Button as={Link} to={`${coursePath}/lessons/${id}`} variant={side === 'next' ? 'primary' : 'outline'} {...{ [side === 'next' ? 'rightIcon' : 'leftIcon']: <Icon as={icon} size={14} /> }}>
        {label}
      </Button>
    )

  return (
    <>
      {back}
      <PageTitle
        eyebrow={t('lesson.eyebrow', { number: lesson.number, total: lesson.total, course: lesson.courseTitle })}
        title={lesson.title}
        description={[t(`enums:lessonType.${lesson.type}`), lesson.durationSec && format.duration(lesson.durationSec), lesson.contentLanguage && format.languageName(lesson.contentLanguage)].filter(Boolean).join(' · ')}
        actions={!lesson.enrolled && lesson.isPreview ? <PillBadge tone="info">{t('lesson.preview')}</PillBadge> : null}
      />
      <Panel padding={24} className={styles.panel}>
        <LessonContent lesson={lesson} />
      </Panel>
      <nav className={styles.steps} aria-label={t('lesson.stepsLabel')}>
        {step(lesson.previousId, t('lesson.previous'), ArrowLeft, 'previous') || <span />}
        {step(lesson.nextId, t('lesson.next'), ArrowRight, 'next') || (
          <Button as={Link} to={coursePath} variant="outline">
            {t('lesson.toCourse')}
          </Button>
        )}
      </nav>
    </>
  )
}
