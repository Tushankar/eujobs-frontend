import { lazyPage } from '@/app/lazyPage.js'

const coursesPage = lazyPage(() => import('./pages/CoursesPage.jsx'))

/* The second Figma "Courses" frame is the Recruiter courses tab of the same page. */
export default [
  { path: 'courses', lazy: coursesPage },
  { path: 'courses/recruiter', lazy: coursesPage },
]
