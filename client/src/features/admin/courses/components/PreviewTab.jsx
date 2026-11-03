import { useTranslation } from 'react-i18next'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Panel } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './builder.module.css'

/** Preview (M-101): the learner-facing copy, curriculum and prices as saved, with each text lesson rendered. */
export default function PreviewTab({ course }) {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const duration = course.lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0)
  return (
    <div className={styles.stack} data-course-preview>
      <Panel padding={24} className={styles.stack}>
        {course.cover && <img src={course.cover.url} alt="" className={styles.cover} />}
        <p className={styles.muted}>{[course.category, course.level && t(`enums:courseLevel.${course.level}`), duration > 0 && format.duration(duration)].filter(Boolean).join(' · ')}</p>
        <h2 className={styles.previewTitle}>{course.title}</h2>
        {course.tagline && <p className={styles.muted}>{course.tagline}</p>}
        <p>{course.summary}</p>
        <p>{course.audience === 'recruiter' ? course.lead : course.about}</p>
        {course.designedFor && <p className={styles.muted}>{t('preview.designedFor', { text: course.designedFor })}</p>}
        <ol className={styles.previewList}>
          {course.outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ol>
        <div className={styles.row}>
          {course.skillTags.map((tag) => (
            <PillBadge key={tag} tone="accent">
              {tag}
            </PillBadge>
          ))}
        </div>
        <p className={styles.heading}>
          {course.isFree
            ? t('details.free')
            : course.prices.map((price) => format.money(price.amountMinor, price.currency)).join(' · ') || t('preview.noPrices')}
        </p>
      </Panel>
      {course.lessons.map((lesson, index) => (
        <Panel key={lesson.id} padding={24} className={styles.stack}>
          <div className={styles.row}>
            <h3 className={styles.lessonTitle}>
              {index + 1}. {lesson.title}
            </h3>
            {lesson.isPreview && <PillBadge tone="info">{t('lessons.previewBadge')}</PillBadge>}
          </div>
          <p className={styles.muted}>{[t(`enums:lessonType.${lesson.type}`), lesson.durationSec && format.duration(lesson.durationSec)].filter(Boolean).join(' · ')}</p>
          {lesson.type === 'text' && <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: lesson.textHtml }} />}
          {lesson.type === 'video' && lesson.video && <video className={styles.videoPreview} src={lesson.video.url} controls preload="metadata" />}
          {lesson.type === 'document' && lesson.document && (
            <a href={lesson.document.url} target="_blank" rel="noopener">
              {lesson.document.name}
            </a>
          )}
          {lesson.type === 'link' && lesson.url && (
            <a href={lesson.url} target="_blank" rel="noopener noreferrer">
              {lesson.url}
            </a>
          )}
        </Panel>
      ))}
      <p className={styles.muted}>{t('preview.quiz', { count: course.quiz.questions.length, passMark: course.quiz.passMark })}</p>
    </div>
  )
}
