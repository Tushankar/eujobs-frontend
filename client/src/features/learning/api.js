import { api } from '@/app/api.js'

/*
 * Learning for candidates and recruiters (§3.9): the catalogue, course details, lessons and free enrolment.
 * Paid courses go through the Phase 5 Checkout (`kind: course`); its return page refreshes 'Enrollments'.
 */
export const learningApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCourses: build.query({ query: () => '/courses', transformResponse: (response) => response.items, providesTags: ['Courses', 'Enrollments'] }),
    getCourse: build.query({ query: (id) => `/courses/${id}`, providesTags: ['Courses', 'Enrollments'] }),
    getLesson: build.query({ query: ({ courseId, lessonId }) => `/learning/courses/${courseId}/lessons/${lessonId}`, providesTags: ['Enrollments'] }),
    enrollFree: build.mutation({ query: (courseId) => ({ url: '/learning/enrollments', method: 'POST', body: { courseId } }), invalidatesTags: ['Enrollments'] }),
  }),
})

export const { useGetCoursesQuery, useGetCourseQuery, useGetLessonQuery, useEnrollFreeMutation } = learningApi
