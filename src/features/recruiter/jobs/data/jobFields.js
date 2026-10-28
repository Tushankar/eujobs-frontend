/*
 * Create-a-job wizard model: steps, option lists, form values <-> job conversion, validation and the
 * local "AI analysis" checks. Also holds the small formatters shared with Job details.
 *
 * Form values are strings (and string[] for skills) so inputs stay controlled; a job stores numbers.
 */
import { EMPLOYMENT_TYPES, WORK_PREFERENCES } from './jobs.js'

export const JOB_STEPS = [
  { id: 'basics', label: 'Basic information' },
  { id: 'responsibilities', label: 'Responsibilities' },
  { id: 'required-skills', label: 'Required skills' },
  { id: 'preferred-skills', label: 'Preferred skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'location', label: 'Location & work' },
  { id: 'analysis', label: 'AI analysis' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Publish' },
]

export const JOB_LEVELS = ['Junior', 'Mid-level', 'Senior', 'Lead']

export const SKILL_SUGGESTIONS = [
  'Product Design',
  'UX Design',
  'Figma',
  'Design Systems',
  'User Research',
  'Prototyping',
  'Interaction Design',
  'Accessibility',
  'Data Analysis',
  'Communication',
  'Project Management',
  'Leadership',
]

export const EMPTY_VALUES = {
  title: '',
  company: 'Acme Studio',
  employmentType: 'Full-time',
  description: '',
  responsibilities: '',
  requiredSkills: [],
  preferredSkills: [],
  level: '',
  experienceYears: '',
  location: '',
  workPreference: '',
  salaryMin: '',
  salaryMax: '',
}

const MIN_DESCRIPTION_LENGTH = 40

function toNumber(text) {
  const trimmed = String(text).trim()
  return trimmed === '' ? null : Number(trimmed)
}

function toText(number) {
  return number == null ? '' : String(number)
}

/** Stored job -> form values (missing optional fields become empty inputs). */
export function jobToValues(job) {
  return {
    title: job.title ?? '',
    company: job.company ?? '',
    employmentType: job.employmentType ?? '',
    description: job.description ?? '',
    responsibilities: (job.responsibilities ?? []).join('\n'),
    requiredSkills: job.requiredSkills ?? [],
    preferredSkills: job.preferredSkills ?? [],
    level: job.level ?? '',
    experienceYears: toText(job.experienceYears),
    location: job.location ?? '',
    workPreference: job.workPreference ?? '',
    salaryMin: toText(job.salaryMin),
    salaryMax: toText(job.salaryMax),
  }
}

/** Form values -> the fields stored on a job (trimmed, numbers parsed). */
export function valuesToJob(values) {
  return {
    title: values.title.trim(),
    company: values.company.trim(),
    employmentType: values.employmentType,
    description: values.description.trim(),
    responsibilities: values.responsibilities
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    requiredSkills: values.requiredSkills,
    preferredSkills: values.preferredSkills,
    level: values.level,
    experienceYears: toNumber(values.experienceYears),
    location: values.location.trim(),
    workPreference: values.workPreference,
    salaryMin: toNumber(values.salaryMin),
    salaryMax: toNumber(values.salaryMax),
  }
}

function isWholeNumber(text, { min, max }) {
  const number = Number(text)
  return text.trim() !== '' && Number.isInteger(number) && number >= min && number <= max
}

/** Validation for one wizard step. Returns { fieldName: 'message naming the problem' }. */
export function validateStep(stepId, values) {
  const errors = {}
  if (stepId === 'basics') {
    if (!values.title.trim()) errors.title = 'Enter a job title, like Senior Product Designer.'
    else if (values.title.trim().length < 3) errors.title = 'Job title must be at least 3 characters.'
    if (!values.company.trim()) errors.company = 'Enter the company name.'
    if (!EMPLOYMENT_TYPES.includes(values.employmentType)) errors.employmentType = 'Choose an employment type.'
  }
  if (stepId === 'responsibilities') {
    if (!values.description.trim()) errors.description = 'Write a short brief describing the role.'
    else if (values.description.trim().length < MIN_DESCRIPTION_LENGTH) {
      errors.description = `The brief needs at least ${MIN_DESCRIPTION_LENGTH} characters so candidates understand the role.`
    }
  }
  if (stepId === 'required-skills' && values.requiredSkills.length === 0) {
    errors.requiredSkills = 'Add at least one required skill.'
  }
  if (stepId === 'experience') {
    if (!JOB_LEVELS.includes(values.level)) errors.level = 'Choose a seniority level.'
    if (!isWholeNumber(values.experienceYears, { min: 0, max: 50 })) {
      errors.experienceYears = 'Enter the minimum years of experience as a whole number from 0 to 50.'
    }
  }
  if (stepId === 'location') {
    if (!values.location.trim()) errors.location = 'Enter the job location, like San Francisco, US.'
    if (!WORK_PREFERENCES.includes(values.workPreference)) errors.workPreference = 'Choose Remote, Hybrid or On-site.'
    const min = toNumber(values.salaryMin)
    const max = toNumber(values.salaryMax)
    if (min != null && !(min >= 0)) errors.salaryMin = 'Enter the minimum salary as a positive number.'
    if (max != null && !(max >= 0)) errors.salaryMax = 'Enter the maximum salary as a positive number.'
    if (!errors.salaryMin && !errors.salaryMax && min != null && max != null && max < min) {
      errors.salaryMax = 'Maximum salary must be at least the minimum salary.'
    }
  }
  return errors
}

/** Full validation used by Publish: all errors plus the index of the first step that has one (-1 if none). */
export function validateAll(values) {
  let errors = {}
  let firstStep = -1
  JOB_STEPS.forEach((step, index) => {
    const stepErrors = validateStep(step.id, values)
    if (firstStep === -1 && Object.keys(stepErrors).length > 0) firstStep = index
    errors = { ...errors, ...stepErrors }
  })
  return { errors, firstStep }
}

/** "$140k – $180k", "From $140k", "Up to $180k" or '' when no salary is set. */
export function formatSalary({ salaryMin, salaryMax }) {
  const short = (amount) => {
    const thousands = amount / 1000
    return `$${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`
  }
  if (salaryMin != null && salaryMax != null) return `${short(salaryMin)} – ${short(salaryMax)}`
  if (salaryMin != null) return `From ${short(salaryMin)}`
  if (salaryMax != null) return `Up to ${short(salaryMax)}`
  return ''
}

/** "Acme Studio · San Francisco, US · Remote · $140k – $180k": whatever parts the job has. */
export function jobMetaLine(job) {
  return [job.company, job.location, job.workPreference, formatSalary(job)].filter(Boolean).join(' · ')
}

/** Local, rule-based review of the entered values (no AI model): [{ id, ok, text }]. */
export function analyzeJob(values) {
  const job = valuesToJob(values)
  const required = job.requiredSkills.length
  return [
    {
      id: 'title',
      ok: job.title.split(/\s+/).filter(Boolean).length >= 2,
      text: 'The title is specific. Candidates search by role and level, so add both.',
      okText: 'The title is specific enough for candidates to search by role and level.',
    },
    {
      id: 'brief',
      ok: job.description.length >= 120,
      text: 'The brief is short. A few more sentences on the team and the impact of the role help matching.',
      okText: 'The brief gives enough context about the role.',
    },
    {
      id: 'responsibilities',
      ok: job.responsibilities.length >= 3,
      text: 'Fewer than three responsibilities are listed. Add the main outcomes of the role.',
      okText: `${job.responsibilities.length} responsibilities are listed.`,
    },
    {
      id: 'skills',
      ok: required >= 3 && required <= 8,
      text:
        required > 8
          ? `${required} required skills is a long list. Move nice-to-haves to preferred skills.`
          : `Only ${required} required ${required === 1 ? 'skill is' : 'skills are'} listed. Three to eight gives matching enough to work with.`,
      okText: `${required} required skills are listed, a good range for matching.`,
    },
    {
      id: 'salary',
      ok: job.salaryMin != null && job.salaryMax != null,
      text: 'No full salary range is shown. Roles with a range usually attract more relevant applicants.',
      okText: `The salary range (${formatSalary(job)}) is visible to candidates.`,
    },
  ].map(({ id, ok, text, okText }) => ({ id, ok, text: ok ? okText : text }))
}
