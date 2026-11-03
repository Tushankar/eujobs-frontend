import { lazyPage } from '@/app/lazyPage.js'

const coursesPage = lazyPage(() => import('./pages/CoursesPage.jsx'))
const builderPage = lazyPage(() => import('./pages/CourseBuilderPage.jsx'))
const learnersPage = lazyPage(() => import('./pages/CourseLearnersPage.jsx'))

/* The second Figma "Courses" frame is the Recruiter courses tab of the same page; the builder is full-page (M-101). */
export default [
  { path: 'courses', lazy: coursesPage },
  { path: 'courses/recruiter', lazy: coursesPage },
  { path: 'courses/new', lazy: builderPage },
  { path: 'courses/:courseId/edit', lazy: builderPage },
  { path: 'courses/:courseId/learners', lazy: learnersPage },
]
