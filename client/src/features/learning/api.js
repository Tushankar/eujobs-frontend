import { api } from '@/app/api.js'

/*
 * Learning for candidates and recruiters (§3.9): the catalogue, course details, lessons and free enrolment,
 * progress (U15), the final quiz (M-104), certificates (M-105) and suggestions (OQ-3). Paid courses go through the
 * Phase 5 Checkout (`kind: course`); its return page refreshes 'Enrollments'.
 */
export const learningApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCourses: build.query({ query: () => '/courses', transformResponse: (response) => response.items, providesTags: ['Courses', 'Enrollments'] }),
    getCourse: build.query({ query: (id) => `/courses/${id}`, providesTags: ['Courses', 'Enrollments'] }),
    getLesson: build.query({ query: ({ courseId, lessonId }) => `/learning/courses/${courseId}/lessons/${lessonId}`, providesTags: ['Enrollments'] }),
    enrollFree: build.mutation({ query: (courseId) => ({ url: '/learning/enrollments', method: 'POST', body: { courseId } }), invalidatesTags: ['Enrollments'] }),
    // A completed lesson refreshes the course pages (curriculum states, quiz unlock).
    recordProgress: build.mutation({
      query: ({ lessonId, ...body }) => ({ url: `/learning/lessons/${lessonId}/progress`, method: 'POST', body }),
      invalidatesTags: (result) => (result?.lesson.done ? ['Enrollments'] : []),
    }),
    // Each visit draws freshly shuffled options (M-104), so the quiz is never served from the cache.
    getQuiz: build.query({ query: (courseId) => `/learning/courses/${courseId}/quiz`, keepUnusedDataFor: 0 }),
    submitAttempt: build.mutation({ query: ({ courseId, answers }) => ({ url: `/learning/courses/${courseId}/quiz/attempts`, method: 'POST', body: { answers } }), invalidatesTags: ['Enrollments', 'Certificates'] }),
    getCertificates: build.query({ query: () => '/learning/certificates', transformResponse: (response) => response.items, providesTags: ['Certificates'] }),
    getCertificatePdf: build.mutation({ query: (id) => `/learning/certificates/${id}/pdf` }),
    getSuggestions: build.query({ query: () => '/learning/suggestions', providesTags: ['Enrollments'] }),
    // The public check (U17) needs no session.
    getPublicCertificate: build.query({ query: (code) => `/public/certificates/${code}` }),
  }),
})

export const {
  useGetCoursesQuery,
  useGetCourseQuery,
  useGetLessonQuery,
  useEnrollFreeMutation,
  useRecordProgressMutation,
  useGetQuizQuery,
  useSubmitAttemptMutation,
  useGetCertificatesQuery,
  useGetCertificatePdfMutation,
  useGetSuggestionsQuery,
  useGetPublicCertificateQuery,
} = learningApi
