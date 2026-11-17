import { useShortlistApplicantsMutation } from '@/features/ai/api.js'

/**
 * The job's newest unreviewed applicants ranked by AI for a first read, each with a one-line reason (owner
 * 2026-11-17). One AI use per click; asking again without new applicants is answered from the server cache.
 */
export function useShortlist(jobId) {
  const [run, state] = useShortlistApplicantsMutation()
  return { ...state, run: () => run(jobId).catch(() => {}) }
}
