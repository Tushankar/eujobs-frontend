import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { COURSES, INITIAL_LEARNING, LEARNING_STORAGE_KEY } from '../data/courses.js'

export const formatPrice = (price) => `£${price.toFixed(2)}`

/** Progress of one course given the persisted state. */
function courseProgress(course, state) {
  const purchased = state.purchased.includes(course.id)
  const completed = state.completedLessons[course.id] ?? []
  const done = course.lessons.filter((lesson) => completed.includes(lesson.id)).length
  const total = course.lessons.length
  return { purchased, done, total, started: purchased && done > 0, complete: purchased && done === total }
}

/** Purchased courses and completed lessons (persisted on this device) plus the stats derived from them. */
export function useRecruiterLearning() {
  const [state, setState] = useLocalStorage(LEARNING_STORAGE_KEY, INITIAL_LEARNING)

  const progress = (course) => courseProgress(course, state)
  const all = COURSES.map(progress)

  function purchase(courseId) {
    setState((current) =>
      current.purchased.includes(courseId) ? current : { ...current, purchased: [...current.purchased, courseId] },
    )
  }

  function toggleLesson(courseId, lessonId) {
    setState((current) => {
      const completed = current.completedLessons[courseId] ?? []
      const next = completed.includes(lessonId) ? completed.filter((id) => id !== lessonId) : [...completed, lessonId]
      return { ...current, completedLessons: { ...current.completedLessons, [courseId]: next } }
    })
  }

  const isLessonDone = (courseId, lessonId) => (state.completedLessons[courseId] ?? []).includes(lessonId)

  return {
    progress,
    isLessonDone,
    purchase,
    toggleLesson,
    inProgressCount: all.filter((item) => item.started && !item.complete).length,
    certificateCount: all.filter((item) => item.complete).length,
  }
}
