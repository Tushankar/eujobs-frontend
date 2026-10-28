export const ONBOARDING_STORAGE_KEY = 'lwm.candidate.onboarding'

export const TOTAL_STEPS = 2

/** What the two steps record on this device. Only the resume's file name is kept, never its contents. */
export const INITIAL_ONBOARDING = { resumeName: null, workMode: null, location: null, salaryMin: null }

/** Largest minimum salary accepted, in thousands per year ($1,000k = $1M). */
export const MAX_SALARY_K = 1000
export const MAX_LOCATION_LENGTH = 60
