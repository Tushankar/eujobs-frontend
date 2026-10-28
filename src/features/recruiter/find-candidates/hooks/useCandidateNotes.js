import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'

export const CANDIDATE_NOTES_STORAGE_KEY = 'lwm.recruiter.candidate-notes'

const NO_NOTES = {}

/** Private recruiter notes keyed by candidate id (`{ [candidateId]: text }`), persisted on this device. */
export function useCandidateNotes() {
  const [notes, setNotes] = useSharedLocalStorage(CANDIDATE_NOTES_STORAGE_KEY, NO_NOTES)

  return {
    getNote: (candidateId) => notes[candidateId] ?? '',
    saveNote: (candidateId, text) => setNotes((current) => ({ ...current, [candidateId]: text })),
  }
}
