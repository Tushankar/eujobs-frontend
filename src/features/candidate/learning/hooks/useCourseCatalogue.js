import { useMemo } from 'react'
import { useCourses } from '@/features/admin/courses/hooks/useCourses.js'
import { durationFor, lessonsFor } from '@/features/admin/courses/utils/learnerCourse.js'
import { COURSES } from '../data/courses.js'

/** An admin-uploaded course in the shape the Learning pages read. The copy is generic: the upload form only collects the basics. */
function fromUpload(course) {
  return {
    id: course.id,
    title: course.title,
    category: course.category,
    level: course.level,
    duration: durationFor(course),
    tier: course.price > 0 ? 'Plus' : 'Included',
    price: course.price,
    recommended: false,
    summary: `${course.level}-level course on ${course.category}, with ${course.lessons} guided lessons.`,
    about: `Work through each lesson at your own pace and apply ${course.category} to a real example from your own work.`,
    outcomes: [
      `Explain the core ideas behind ${course.category}.`,
      'Apply them to a practical exercise from your own work.',
      'Create a small piece of evidence you can review before choosing whether to add it to your profile.',
    ],
    lessons: lessonsFor(course),
  }
}

/**
 * The courses learners can see: the built-in catalogue minus any the admin has set to draft,
 * plus the published candidate courses uploaded in Admin > Courses.
 */
export function useCourseCatalogue() {
  const { courses: managed } = useCourses()
  return useMemo(() => {
    const statusOf = (id) => managed.find((course) => course.id === id)?.status
    const uploads = managed.filter(
      (course) => course.audience === 'candidate' && course.status === 'published' && !COURSES.some((known) => known.id === course.id),
    )
    return [...COURSES.filter((course) => statusOf(course.id) !== 'draft'), ...uploads.map(fromUpload)]
  }, [managed])
}
