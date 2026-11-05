import { api } from '@/app/api.js'

/*
 * Recruiter discovery (§3.8): Find candidates, the candidate profile (records a view, M-184), CV access and
 * requests (M-029, M-187), notes (M-080), activity (M-081), the shortlist (M-079) and the Overview (§3.15).
 */
const SHORTLIST_CHANGES = ['Discovery', 'Shortlist', 'RecruiterOverview', 'CandidateActivity']
// A note changes the notes list, the activity timeline and the note count on the Hiring pipeline cards.
const NOTE_CHANGES = ['CandidateNotes', 'CandidateActivity', 'CompanyApplications']

export const discoveryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCandidates: build.query({ query: (params) => ({ url: '/recruiter/candidates', params }), providesTags: ['Discovery'] }),
    getCandidateProfile: build.query({ query: ({ id, jobId }) => ({ url: `/recruiter/candidates/${id}`, params: jobId ? { jobId } : {} }), providesTags: ['Discovery'] }),
    getCandidateCv: build.query({ query: (id) => `/recruiter/candidates/${id}/cv`, providesTags: ['CandidateCv'] }),
    requestCv: build.mutation({ query: ({ id, ...body }) => ({ url: `/recruiter/candidates/${id}/cv-requests`, method: 'POST', body }), invalidatesTags: ['CandidateCv', 'CandidateActivity'] }),
    getCandidateActivity: build.query({ query: (id) => `/recruiter/candidates/${id}/activity`, providesTags: ['CandidateActivity'] }),
    getCandidateNotes: build.query({ query: (id) => `/recruiter/candidates/${id}/notes`, providesTags: ['CandidateNotes'] }),
    addCandidateNote: build.mutation({ query: ({ id, ...body }) => ({ url: `/recruiter/candidates/${id}/notes`, method: 'POST', body }), invalidatesTags: NOTE_CHANGES }),
    editCandidateNote: build.mutation({ query: ({ id, noteId, text }) => ({ url: `/recruiter/candidates/${id}/notes/${noteId}`, method: 'PATCH', body: { text } }), invalidatesTags: NOTE_CHANGES }),
    deleteCandidateNote: build.mutation({ query: ({ id, noteId }) => ({ url: `/recruiter/candidates/${id}/notes/${noteId}`, method: 'DELETE' }), invalidatesTags: NOTE_CHANGES }),
    getShortlist: build.query({ query: (params) => ({ url: '/recruiter/shortlist', params }), providesTags: ['Shortlist'] }),
    addToShortlist: build.mutation({ query: (id) => ({ url: `/recruiter/shortlist/${id}`, method: 'PUT' }), invalidatesTags: SHORTLIST_CHANGES }),
    removeFromShortlist: build.mutation({ query: (id) => ({ url: `/recruiter/shortlist/${id}`, method: 'DELETE' }), invalidatesTags: SHORTLIST_CHANGES }),
    getRecruiterOverview: build.query({ query: () => '/recruiter/overview', providesTags: ['RecruiterOverview'] }),
    getTalent: build.query({ query: () => '/recruiter/overview/talent', providesTags: ['RecruiterOverview'] }),
  }),
})

export const {
  useGetCandidatesQuery,
  useGetCandidateProfileQuery,
  useGetCandidateCvQuery,
  useRequestCvMutation,
  useGetCandidateActivityQuery,
  useGetCandidateNotesQuery,
  useAddCandidateNoteMutation,
  useEditCandidateNoteMutation,
  useDeleteCandidateNoteMutation,
  useGetShortlistQuery,
  useAddToShortlistMutation,
  useRemoveFromShortlistMutation,
  useGetRecruiterOverviewQuery,
  useGetTalentQuery,
} = discoveryApi

/** Toggles a candidate on the company shortlist. */
export function useShortlistToggle() {
  const [add] = useAddToShortlistMutation()
  const [remove] = useRemoveFromShortlistMutation()
  return (candidate) => (candidate.shortlisted ? remove(candidate.id) : add(candidate.id))
}
