import { useTranslation } from 'react-i18next'
import { useFormat, usePreferences } from '@/lib/preferences.js'

/** The learning pages of the signed-in role: /candidate/learning or /recruiter/learning. */
export function useLearningPath() {
  const { me } = usePreferences()
  return `/${me.role}/learning`
}

/** The lesson to open next: the first one not done (enrolled), else the first open one. */
export function nextLessonId(course) {
  return (course.curriculum.find((lesson) => lesson.state === 'open') ?? course.curriculum[0])?.id
}

/**
 * Texts every course view shares (M-100, M-130, §3.9): "Free" or the price in the header country's currency,
 * the duration, the level, and the "Included" list derived from the lessons and the quiz.
 */
export function useCourseText() {
  const { t } = useTranslation('learning')
  const format = useFormat()
  return {
    price: (course) => (course.isFree ? t('price.free') : course.price ? format.money(course.price.amountMinor, course.price.currency) : t('price.unavailable')),
    access: (course) => t(course.isFree ? 'price.freeAccess' : 'price.oneTime'),
    duration: (course) => format.duration(course.durationSec),
    level: (course) => t(`enums:courseLevel.${course.level}`),
    meta: (course) => [course.category, t(`enums:courseLevel.${course.level}`), format.duration(course.durationSec)].join(' · '),
    included: ({ included }) => [
      ...['video', 'text', 'document', 'link'].filter((type) => included[type]).map((type) => t(`included.${type}`, { count: included[type] })),
      t('included.quiz', { count: included.quizQuestions }),
      t('included.certificate'),
      t('included.pace'),
    ],
    progress: (course) => (course.enrollment ? Math.round((course.enrollment.lessonsDone / Math.max(1, course.lessons)) * 100) : 0),
  }
}
