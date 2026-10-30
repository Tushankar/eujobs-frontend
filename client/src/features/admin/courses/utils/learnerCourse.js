/*
 * Learner-side content for courses uploaded in Admin > Courses. The upload form only collects a title, category,
 * level, lesson count and price, so the lesson titles and the duration shown to learners are generated from those.
 */
const MINUTES_PER_LESSON = 35

export function lessonsFor(course) {
  return Array.from({ length: course.lessons }, (_, index) => ({ id: `${course.id}-lesson-${index + 1}`, title: `Lesson ${index + 1}` }))
}

/** "45m", "2h" or "2h 20m", estimated from the lesson count. */
export function durationFor(course) {
  const minutes = course.lessons * MINUTES_PER_LESSON
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${hours}h`
}
