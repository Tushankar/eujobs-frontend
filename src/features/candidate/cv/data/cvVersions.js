export const CV_STORAGE_KEY = 'lwm.candidate.cv'

export const CV_FILE_NAME = 'Alex_Morgan_Resume.pdf'
export const MAX_CV_SIZE_MB = 10
export const ACCEPTED_CV_EXTENSIONS = ['.pdf', '.docx']

const BASE_SNAPSHOT = {
  role: 'Product Designer',
  experience: '5 years',
  skills: ['Product Design', 'Figma', 'Design Systems', 'UX Research', 'Prototyping'],
}

export const DRAFT_NOTE = 'Draft suggestion: clarify impact statements and group related skills. No profile fields were changed.'

/**
 * Version history as shown in the Figma "CV & versions" frame, newest first.
 * Only file names and recorded profile snapshots are kept; file contents are never retained.
 * `approved: false` drafts stay pending until the candidate approves them as the live CV.
 */
export const INITIAL_CV = {
  liveId: 'v1',
  versions: [
    {
      id: 'v3',
      version: 3,
      fileName: CV_FILE_NAME,
      createdAt: '2026-10-13T10:36:00',
      source: 'AI-assisted draft',
      approved: false,
      note: DRAFT_NOTE,
      snapshot: { ...BASE_SNAPSHOT, skills: [...BASE_SNAPSHOT.skills, 'Accessibility', 'Design Critique'] },
    },
    {
      id: 'v2',
      version: 2,
      fileName: CV_FILE_NAME,
      createdAt: '2026-10-13T10:36:00',
      source: 'AI-assisted draft',
      approved: false,
      note: DRAFT_NOTE,
      snapshot: { ...BASE_SNAPSHOT, skills: [...BASE_SNAPSHOT.skills, 'Accessibility'] },
    },
    {
      id: 'v1',
      version: 1,
      fileName: CV_FILE_NAME,
      createdAt: '2026-09-24T10:30:00',
      source: 'Candidate upload',
      tag: 'Original upload',
      approved: true,
      note: 'Original resume uploaded and approved by the candidate.',
      snapshot: BASE_SNAPSHOT,
    },
  ],
}

export const EMPTY_CV = { liveId: null, versions: [] }
