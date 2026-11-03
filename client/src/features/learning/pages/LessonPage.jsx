import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CircleCheck, ExternalLink, FileText, LockKeyhole } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetLessonQuery, useRecordProgressMutation } from '../api.js'
import { useLearningPath } from '../useCourseText.js'
import styles from './LessonPage.module.css'

const VIDEO_EVENTS = ['play', 'pause', 'seeked', 'ratechange', 'ended']

/**
 * U15: while a video plays, a heartbeat every 15 s (the interval comes from GET /meta/config) and one on play,
 * pause, seek, speed change and end. The server decides what counts; the client only reports.
 */
function useVideoHeartbeats(videoRef, report) {
  const { data: config } = useGetConfigQuery()
  const seconds = config?.limits.lessonProgress.heartbeatSec
  useEffect(() => {
    const video = videoRef.current
    if (!video || !seconds || !report) return undefined
    let timer = null
    const beat = () => report({ event: 'heartbeat', positionSec: video.currentTime, rate: video.playbackRate })
    const onEvent = (event) => {
      beat()
      window.clearInterval(timer)
      timer = event.type === 'pause' || event.type === 'ended' || video.paused ? null : window.setInterval(beat, seconds * 1000)
    }
    VIDEO_EVENTS.forEach((type) => video.addEventListener(type, onEvent))
    return () => {
      window.clearInterval(timer)
      VIDEO_EVENTS.forEach((type) => video.removeEventListener(type, onEvent))
    }
  }, [videoRef, report, seconds])
}

/** The lesson's content by type (M-102): a streamed video, sanitised text, an embedded PDF or an external link. */
function LessonContent({ lesson, report }) {
  const { t } = useTranslation('learning')
  const videoRef = useRef(null)
  useVideoHeartbeats(videoRef, lesson.type === 'video' ? report : null)
  if (lesson.type === 'video') {
    return <video ref={videoRef} className={styles.video} src={lesson.media.url} controls preload="metadata" data-lesson-video />
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
      {/* M-103: a link lesson counts on click-through. */}
      <Button as="a" href={lesson.url} target="_blank" rel="noopener noreferrer" leftIcon={<Icon as={ExternalLink} size={14} />} onClick={() => report?.({ event: 'open' })} data-lesson-link>
        {t('lesson.openLink')}
      </Button>
    </div>
  )
}

/**
 * /…/learning/:courseId/lessons/:lessonId: one lesson, with the previous and next lessons (M-106: previews open
 * without buying). For enrolled learners, text and PDF lessons complete when shown (M-103) and videos report progress.
 */
export default function LessonPage() {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const { courseId, lessonId } = useParams()
  const base = useLearningPath()
  const { data: lesson, error } = useGetLessonQuery({ courseId, lessonId })
  const [recordProgress] = useRecordProgressMutation()
  // The last progress answer, kept per lesson so moving to the next lesson starts clean.
  const [answer, setAnswer] = useState(null)
  const progress = answer?.lessonId === lessonId ? answer.progress : null
  const coursePath = `${base}/${courseId}`
  const tracked = Boolean(lesson?.enrolled && !lesson.done)

  // `report` stays the same function for the video listeners; reports stop once the lesson is done.
  const reportRef = useRef(null)
  useEffect(() => {
    reportRef.current =
      tracked && !progress?.lesson.done
        ? (body) => recordProgress({ lessonId, ...body }).unwrap().then((result) => setAnswer({ lessonId, progress: result }), () => {})
        : null
  }, [tracked, progress, recordProgress, lessonId])
  const [report] = useState(() => (body) => reportRef.current?.(body))

  useEffect(() => {
    if (tracked && (lesson.type === 'text' || lesson.type === 'document')) report({ event: 'open' })
  }, [tracked, lesson?.type, lessonId, report])

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

  const done = lesson.done || progress?.lesson.done
  const quizUnlocked = progress?.course.quizUnlocked
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
        actions={
          done ? (
            <PillBadge tone="success" data-lesson-done>
              <Icon as={CircleCheck} size={12} />
              {t('lesson.done')}
            </PillBadge>
          ) : !lesson.enrolled && lesson.isPreview ? (
            <PillBadge tone="info">{t('lesson.preview')}</PillBadge>
          ) : null
        }
      />
      {lesson.enrolled && lesson.type === 'video' && !done && <p className={styles.hint}>{t('lesson.videoHint')}</p>}
      <Panel padding={24} className={styles.panel}>
        <LessonContent lesson={lesson} report={lesson.enrolled ? report : null} />
      </Panel>
      <nav className={styles.steps} aria-label={t('lesson.stepsLabel')}>
        {step(lesson.previousId, t('lesson.previous'), ArrowLeft, 'previous') || <span />}
        {step(lesson.nextId, t('lesson.next'), ArrowRight, 'next') ||
          (quizUnlocked ? (
            <Button as={Link} to={`${coursePath}/quiz`} rightIcon={<Icon as={ArrowRight} size={14} />} data-take-quiz>
              {t('quiz.take')}
            </Button>
          ) : (
            <Button as={Link} to={coursePath} variant="outline">
              {t('lesson.toCourse')}
            </Button>
          ))}
      </nav>
    </>
  )
}
