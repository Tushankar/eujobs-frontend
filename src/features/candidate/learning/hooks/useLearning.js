import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { INITIAL_LEARNING, LEARNING_STORAGE_KEY } from '../data/courses.js'
import { useCourseCatalogue } from './useCourseCatalogue.js'

export function formatPrice(price) {
  return `£${price.toFixed(2)}`
}

/** Progress of one course given the persisted state. */
export function courseProgress(course, state) {
  const purchased = state.purchased.includes(course.id)
  const completed = state.completedLessons[course.id] ?? []
  const done = course.lessons.filter((lesson) => completed.includes(lesson.id)).length
  const total = course.lessons.length
  return {
    purchased,
    done,
    total,
    percent: Math.round((done / total) * 100),
    started: purchased && done > 0,
    complete: purchased && done === total,
  }
}

/** Purchased courses, completed lessons and the stats derived from them, persisted on this device. */
export function useLearning() {
  const [state, setState] = useLocalStorage(LEARNING_STORAGE_KEY, INITIAL_LEARNING)
  const courses = useCourseCatalogue()

  const progress = (course) => courseProgress(course, state)
  const all = courses.map(progress)

  function purchase(courseId) {
    setState((current) =>
      current.purchased.includes(courseId) ? current : { ...current, purchased: [...current.purchased, courseId] },
    )
  }

  function toggleLesson(courseId, lessonId) {
    setState((current) => {
      const completed = current.completedLessons[courseId] ?? []
      const next = completed.includes(lessonId)
        ? completed.filter((id) => id !== lessonId)
        : [...completed, lessonId]
      return { ...current, completedLessons: { ...current.completedLessons, [courseId]: next } }
    })
  }

  return {
    courses,
    state,
    progress,
    purchase,
    toggleLesson,
    inProgressCount: all.filter((item) => item.started && !item.complete).length,
    completedCount: all.filter((item) => item.complete).length,
  }
}
