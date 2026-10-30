import { useMemo } from 'react'
import { useCourses } from '@/features/admin/courses/hooks/useCourses.js'
import { durationFor, lessonsFor } from '@/features/admin/courses/utils/learnerCourse.js'
import photo from '@/assets/images/recruiter-learning-strategy.jpg'
import { COURSES } from '../data/courses.js'

/** An admin-uploaded course in the shape the recruiter Learning pages read. The copy is generic: the upload form only collects the basics. */
function fromUpload(course) {
  return {
    id: course.id,
    title: course.title,
    stream: course.category,
    level: course.level,
    duration: durationFor(course),
    price: course.price,
    access: course.price > 0 ? 'One-time course access' : 'Free course access',
    photo,
    summary: `${course.level}-level course on ${course.category} for recruiters, with ${course.lessons} guided lessons.`,
    lead: `Build practical ${course.category} skills you can use in your day-to-day recruiting.`,
    tagline: `Practical learning for recruiters: ${course.category}.`,
    designedFor: `Recruiters who want to strengthen their ${course.category} practice`,
    outcomes: [
      `Explain the core ideas behind ${course.category}.`,
      'Apply them to a real recruiting situation.',
      'Review your own approach and decide what to change.',
    ],
    lessons: lessonsFor(course),
  }
}

/**
 * The courses recruiters can see: the built-in catalogue minus any the admin has set to draft,
 * plus the published recruiter courses uploaded in Admin > Courses.
 */
export function useCourseCatalogue() {
  const { courses: managed } = useCourses()
  return useMemo(() => {
    const statusOf = (id) => managed.find((course) => course.id === id)?.status
    const uploads = managed.filter(
      (course) => course.audience === 'recruiter' && course.status === 'published' && !COURSES.some((known) => known.id === course.id),
    )
    return [...COURSES.filter((course) => statusOf(course.id) !== 'draft'), ...uploads.map(fromUpload)]
  }, [managed])
}
