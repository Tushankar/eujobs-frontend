import { api } from '@/app/api.js'
import { getToken } from '@/app/token.js'

/*
 * Admin > Courses (§3.9, M-101 … M-111): the list with counts and the full-page builder. Every builder change
 * answers with the whole course, which replaces the cached one.
 */
const writesCourse = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(adminCoursesApi.util.upsertQueryData('getAdminCourse', data.id, data))
    } catch {
      // The caller shows the error; the cached course is unchanged.
    }
  },
  invalidatesTags: [{ type: 'AdminCourses', id: 'LIST' }, 'Courses'],
}

export const adminCoursesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminCourses: build.query({ query: (audience) => ({ url: '/admin/courses', params: { audience } }), providesTags: [{ type: 'AdminCourses', id: 'LIST' }] }),
    getAdminCourse: build.query({ query: (id) => `/admin/courses/${id}`, providesTags: (result, error, id) => [{ type: 'AdminCourses', id }] }),
    createCourse: build.mutation({ query: (body) => ({ url: '/admin/courses', method: 'POST', body }), ...writesCourse }),
    updateCourse: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/courses/${id}`, method: 'PATCH', body }), ...writesCourse }),
    addLesson: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/courses/${id}/lessons`, method: 'POST', body }), ...writesCourse }),
    updateLesson: build.mutation({ query: ({ id, lessonId, ...body }) => ({ url: `/admin/courses/${id}/lessons/${lessonId}`, method: 'PATCH', body }), ...writesCourse }),
    deleteLesson: build.mutation({ query: ({ id, lessonId }) => ({ url: `/admin/courses/${id}/lessons/${lessonId}`, method: 'DELETE' }), ...writesCourse }),
    reorderLessons: build.mutation({ query: ({ id, lessonIds }) => ({ url: `/admin/courses/${id}/lessons/order`, method: 'PUT', body: { lessonIds } }), ...writesCourse }),
    saveQuiz: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/courses/${id}/quiz`, method: 'PUT', body }), ...writesCourse }),
    setCourseStatus: build.mutation({ query: ({ id, status }) => ({ url: `/admin/courses/${id}/status`, method: 'PATCH', body: { status } }), ...writesCourse }),
    previewMarkdown: build.mutation({ query: (markdown) => ({ url: '/admin/markdown/preview', method: 'POST', body: { markdown } }) }),
  }),
})

export const {
  useGetAdminCoursesQuery,
  useGetAdminCourseQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useAddLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useReorderLessonsMutation,
  useSaveQuizMutation,
  useSetCourseStatusMutation,
  usePreviewMarkdownMutation,
} = adminCoursesApi

/**
 * POST /admin/uploads?purpose= with upload progress (0–1) through `onProgress`. Resolves with the file
 * { id, name, size, mime, url }; rejects with the API's error shape ({ status, data: { error } }).
 */
export function uploadCourseFile(purpose, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${import.meta.env.VITE_API_URL ?? ''}/api/v1/admin/uploads?purpose=${purpose}`)
    request.setRequestHeader('Authorization', `Bearer ${getToken()}`)
    request.responseType = 'json'
    request.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total)
    request.onload = () => (request.status < 300 ? resolve(request.response) : reject({ status: request.status, data: request.response }))
    request.onerror = () => reject({ status: 'FETCH_ERROR', data: null })
    const body = new FormData()
    body.append('file', file)
    request.send(body)
  })
}
