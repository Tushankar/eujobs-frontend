import { api } from '@/app/api.js'
import { usePageVisible } from '@/hooks/usePageVisible.js'

/*
 * Interviews and document requests (§3.23). Every change refreshes the thread (its cards and event lines), the
 * upcoming list and the applications, whose stage or activity may move with it.
 */
const CHANGES = ['Conversations', 'Interviews', 'Applications', 'CompanyApplications', 'Pipeline', 'Counters', 'Notifications']
const POLL_MS = 15_000

const post = (url, body) => ({ url, method: 'POST', body })
/** A multipart body: the file (if any) and the other fields as strings. */
const form = (fields, file) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) if (value !== undefined && value !== '') data.append(name, typeof value === 'string' ? value : JSON.stringify(value))
  if (file) data.append('file', file)
  return data
}

export const interviewsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getInterview: build.query({ query: (id) => `/interviews/${id}`, providesTags: ['Interviews'] }),
    getUpcomingInterviews: build.query({ query: () => '/interviews/upcoming', providesTags: ['Interviews'] }),
    getInterviewNotes: build.query({ query: (id) => `/interviews/${id}/notes`, providesTags: ['Interviews'] }),
    offerInterview: build.mutation({ query: (body) => post('/interviews', body), invalidatesTags: CHANGES }),
    rescheduleInterview: build.mutation({ query: ({ id, ...body }) => post(`/interviews/${id}/reschedule`, body), invalidatesTags: CHANGES }),
    cancelInterview: build.mutation({ query: ({ id, ...body }) => post(`/interviews/${id}/cancel`, body), invalidatesTags: CHANGES }),
    recordOutcome: build.mutation({ query: ({ id, ...body }) => post(`/interviews/${id}/outcome`, body), invalidatesTags: CHANGES }),
    pickSlot: build.mutation({ query: ({ id, startAt }) => post(`/interviews/${id}/pick`, { startAt }), invalidatesTags: CHANGES }),
    askOtherTimes: build.mutation({ query: ({ id, note }) => post(`/interviews/${id}/other-times`, { note }), invalidatesTags: CHANGES }),
    requestReschedule: build.mutation({ query: ({ id, note }) => post(`/interviews/${id}/reschedule-request`, { note }), invalidatesTags: CHANGES }),
    joinInterview: build.mutation({ query: (id) => post(`/interviews/${id}/join`) }),
    setConsent: build.mutation({ query: ({ id, agree }) => post(`/interviews/${id}/consent`, { agree }) }),
    startRecording: build.mutation({ query: (id) => post(`/interviews/${id}/recording/start`) }),
    stopRecording: build.mutation({ query: (id) => post(`/interviews/${id}/recording/stop`) }),
    getDocumentRequest: build.query({ query: (id) => `/document-requests/${id}`, providesTags: ['Interviews'] }),
    requestDocuments: build.mutation({ query: ({ file, ...fields }) => post('/document-requests', form(fields, file)), invalidatesTags: CHANGES }),
    uploadDocument: build.mutation({ query: ({ id, itemId, file }) => post(`/document-requests/${id}/items/${itemId}`, form({}, file)), invalidatesTags: CHANGES }),
    declineDocument: build.mutation({ query: ({ id, itemId, note }) => post(`/document-requests/${id}/items/${itemId}/decline`, { note }), invalidatesTags: CHANGES }),
    completeRequest: build.mutation({ query: (id) => post(`/document-requests/${id}/complete`), invalidatesTags: CHANGES }),
  }),
})

export const {
  useGetInterviewQuery,
  useGetInterviewNotesQuery,
  useOfferInterviewMutation,
  useRescheduleInterviewMutation,
  useCancelInterviewMutation,
  useRecordOutcomeMutation,
  usePickSlotMutation,
  useAskOtherTimesMutation,
  useRequestRescheduleMutation,
  useJoinInterviewMutation,
  useSetConsentMutation,
  useStartRecordingMutation,
  useStopRecordingMutation,
  useGetDocumentRequestQuery,
  useRequestDocumentsMutation,
  useUploadDocumentMutation,
  useDeclineDocumentMutation,
  useCompleteRequestMutation,
} = interviewsApi

/** Booked interviews still to come (P11d-Q16), refreshed with the other 15-second polls while the tab is visible. */
export function useUpcomingInterviews() {
  const visible = usePageVisible()
  return interviewsApi.useGetUpcomingInterviewsQuery(undefined, { pollingInterval: visible ? POLL_MS : 0 })
}

/** Joins a date (YYYY-MM-DD) and a time (HH:MM) typed in the viewer's time zone into an ISO instant. */
export const toInstant = (date, time) => new Date(`${date}T${time}`).toISOString()

/** Whether the join window is open now (P11d-Q26). */
export const joinOpen = (interview, now = Date.now()) =>
  interview.status === 'confirmed' && interview.mode === 'video' && new Date(interview.joinOpensAt).getTime() <= now && now <= new Date(interview.joinClosesAt).getTime()
