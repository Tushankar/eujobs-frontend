/*
 * Create-a-job wizard model (§3.7, M-033, M-035, M-039, P4-D6 … D8): steps, form values <-> the API body, and the
 * client checks per step, which mirror the server's (limits from GET /meta/config). Form values are strings so
 * inputs stay controlled; the body holds numbers and keys.
 */
export const JOB_STEPS = ['basics', 'responsibilities', 'required-skills', 'preferred-skills', 'experience', 'location', 'quality', 'review', 'publish']

export const EMPTY_VALUES = {
  title: '',
  employmentType: 'full_time',
  brief: '',
  responsibilities: '',
  requiredSkills: [],
  preferredSkills: [],
  level: '',
  experienceYears: '',
  requiredLanguages: [],
  workPreference: '',
  place: null,
  remoteCountries: [],
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: 'year',
  visaSponsorship: false,
}

const toNumber = (text) => (String(text).trim() === '' ? null : Number(String(text).trim()))
const toText = (number) => (number == null ? '' : String(number))
const lines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** A job from the API -> form values. */
export function jobToValues(job) {
  return {
    title: job.title ?? '',
    employmentType: job.employmentType ?? 'full_time',
    brief: job.brief ?? '',
    responsibilities: job.responsibilities.join('\n'),
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    level: job.level ?? '',
    experienceYears: toText(job.experienceYears),
    requiredLanguages: job.requiredLanguages,
    workPreference: job.workPreference ?? '',
    place: job.location,
    remoteCountries: job.remoteCountries,
    salaryMin: toText(job.salary?.min),
    salaryMax: toText(job.salary?.max),
    salaryPeriod: job.salary?.period ?? 'year',
    visaSponsorship: job.visaSponsorship,
  }
}

/** Form values -> the job body of POST/PUT /recruiter/jobs. */
export function valuesToBody(values) {
  const remote = values.workPreference === 'remote'
  const min = toNumber(values.salaryMin)
  const max = toNumber(values.salaryMax)
  return {
    title: values.title.trim(),
    employmentType: values.employmentType,
    brief: values.brief.trim(),
    responsibilities: lines(values.responsibilities),
    requiredSkills: values.requiredSkills,
    preferredSkills: values.preferredSkills,
    level: values.level || null,
    experienceYears: toNumber(values.experienceYears),
    requiredLanguages: values.requiredLanguages,
    visaSponsorship: values.visaSponsorship,
    workPreference: values.workPreference || null,
    placeId: !remote && values.place ? values.place.placeId : null,
    remoteCountries: remote ? values.remoteCountries : [],
    salary: min == null && max == null ? null : { min, max, period: values.salaryPeriod },
  }
}

const blank = (text) => !String(text ?? '').trim()

function wholeNumber(text, { min, max }) {
  const value = String(text).trim()
  if (!/^\d+$/.test(value)) return { key: 'invalid' }
  if (Number(value) < min) return { key: 'too_small', params: { min } }
  return Number(value) > max ? { key: 'too_big', params: { max } } : undefined
}

/**
 * The checks of one step as { field: { key, params } }. `publishing` adds what publishing needs (M-039); a draft
 * only needs step 1 (P4-D7).
 */
export function validateStep(step, values, limits, { publishing = false } = {}) {
  const J = limits.job
  const errors = {}
  const need = (field, empty) => {
    if (publishing && empty) errors[field] = { key: 'required' }
  }
  if (step === 'basics') {
    const title = values.title.trim()
    if (!title) errors.title = { key: 'required' }
    else if (title.length < J.title.min) errors.title = { key: 'too_short', params: { min: J.title.min } }
    else if (title.length > J.title.max) errors.title = { key: 'too_long', params: { max: J.title.max } }
    if (!values.employmentType) errors.employmentType = { key: 'required' }
  }
  if (step === 'responsibilities') {
    const brief = values.brief.trim()
    if (brief.length > J.brief.max) errors.brief = { key: 'too_long', params: { max: J.brief.max } }
    else if (publishing && !brief) errors.brief = { key: 'required' }
    else if (publishing && brief.length < J.brief.min) errors.brief = { key: 'too_short', params: { min: J.brief.min } }
    const items = lines(values.responsibilities)
    if (items.length > J.responsibilities.max) errors.responsibilities = { key: 'too_many', params: { max: J.responsibilities.max } }
    else if (items.some((item) => item.length > J.responsibilities.itemMax)) errors.responsibilities = { key: 'too_long', params: { max: J.responsibilities.itemMax } }
  }
  if (step === 'required-skills') need('requiredSkills', values.requiredSkills.length === 0)
  if (step === 'experience') {
    need('level', !values.level)
    if (!blank(values.experienceYears)) {
      const problem = wholeNumber(values.experienceYears, J.experienceYears)
      if (problem) errors.experienceYears = problem
    } else need('experienceYears', true)
  }
  if (step === 'location') {
    need('workPreference', !values.workPreference)
    if (values.workPreference && values.workPreference !== 'remote') need('placeId', !values.place)
    for (const field of ['salaryMin', 'salaryMax']) {
      if (!blank(values[field])) {
        const problem = wholeNumber(values[field], J.salary)
        if (problem) errors[field] = problem
      }
    }
    if (!errors.salaryMin && !errors.salaryMax && !blank(values.salaryMin) && !blank(values.salaryMax) && Number(values.salaryMax) < Number(values.salaryMin)) {
      errors.salaryMax = { key: 'below_min' }
    }
  }
  return errors
}

/** Every step's errors plus the first step that has one (-1 when none). */
export function validateAll(values, limits) {
  let errors = {}
  let firstStep = -1
  JOB_STEPS.forEach((step, index) => {
    const stepErrors = validateStep(step, values, limits, { publishing: true })
    if (firstStep === -1 && Object.keys(stepErrors).length > 0) firstStep = index
    errors = { ...errors, ...stepErrors }
  })
  return { errors, firstStep }
}

/** A server VALIDATION_FAILED on the job body, as form errors (the body's names map back to the form's). */
export function bodyErrorsToForm(fields) {
  const renamed = { 'salary.min': 'salaryMin', 'salary.max': 'salaryMax', salary: 'salaryMin' }
  return Object.fromEntries(Object.entries(fields).map(([field, error]) => [renamed[field] ?? field.split('.')[0], error]))
}
