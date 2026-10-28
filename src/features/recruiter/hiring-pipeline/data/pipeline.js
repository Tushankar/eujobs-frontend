export const PIPELINE_STORAGE_KEY = 'lwm.recruiter.pipeline'

/** Placement value for an applicant who has been rejected (not a board column). */
export const REJECTED = 'rejected'

export const MAX_STAGE_NAME_LENGTH = 24

/** `tone` is the colour of the stage dot on the board: neutral (grey), primary (blue) or success (green). */
export const DEFAULT_STAGES = [
  { id: 'applied', name: 'Applied', tone: 'neutral' },
  { id: 'screening', name: 'Screening', tone: 'primary' },
  { id: 'shortlisted', name: 'Shortlisted', tone: 'primary' },
  { id: 'interview', name: 'Interview', tone: 'primary' },
  { id: 'offer', name: 'Offer', tone: 'success' },
  { id: 'hired', name: 'Hired', tone: 'success' },
]

/*
 * The six applicants are the Find candidates profiles (same ids). Order is the Applications table order;
 * the board lists each column's applicants in this order too. `alignedSkills` is the "N aligned skills"
 * count on the board cards.
 */
export const APPLICANTS = [
  { id: 'emma-wilson', alignedSkills: 3 },
  { id: 'james-chen', alignedSkills: 2 },
  { id: 'sofia-martinez', alignedSkills: 1 },
  { id: 'oliver-park', alignedSkills: 3 },
  { id: 'aisha-patel', alignedSkills: 0 },
  { id: 'daniel-kim', alignedSkills: 1 },
]

export const DEFAULT_PLACEMENTS = {
  'emma-wilson': 'screening',
  'james-chen': 'shortlisted',
  'sofia-martinez': 'applied',
  'oliver-park': 'interview',
  'aisha-patel': 'applied',
  'daniel-kim': 'applied',
}

export const INITIAL_PIPELINE = { stages: DEFAULT_STAGES, placements: DEFAULT_PLACEMENTS }
