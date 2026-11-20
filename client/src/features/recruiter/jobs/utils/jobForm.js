import { currentRole } from '@/app/roles.js'
/*
 * Create-a-job wizard model (§3.7, M-033, M-035, M-039, P4-D6 … D8): steps, form values <-> the API body, and the
 * client checks per step, which mirror the server's (limits from GET /meta/config). Form values are strings so
 * inputs stay controlled; the body holds numbers and keys.
 */
const STEPS = ['basics', 'responsibilities', 'required-skills', 'preferred-skills', 'experience', 'location', 'quality', 'review', 'publish']

/** The wizard's steps; an agency (2026-11-20) also sets its terms (client, dates, rate, contract) after the location. */
export function jobSteps(role = currentRole()) {
  if (role !== 'agency') return STEPS
  const at = STEPS.indexOf('location') + 1
  return [...STEPS.slice(0, at), 'agency', ...STEPS.slice(at)]
}

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
  // A remote job's salary currency (recruiter's choice, 2026-11-16); other jobs pay in their country's currency.
  salaryCurrency: 'EUR',
  visaSponsorship: false,
  // Agency jobs (2026-11-20): the client, the dates, the pay rate (major units) and the hours per week.
  clientId: '',
  showClient: true,
  startDate: '',
  endDate: '',
  rateAmount: '',
  ratePeriod: 'hour',
  hoursPerWeek: '',
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
    salaryCurrency: (job.country === 'REMOTE' && job.salary?.currency) || 'EUR',
    visaSponsorship: job.visaSponsorship,
    clientId: job.agency?.clientId ?? '',
    showClient: job.agency?.showClient ?? true,
    startDate: job.agency?.startDate ?? '',
    endDate: job.agency?.endDate ?? '',
    rateAmount: job.agency?.rate ? String(job.agency.rate.amountMinor / 100) : '',
    ratePeriod: job.agency?.rate?.period ?? 'hour',
    hoursPerWeek: toText(job.agency?.hoursPerWeek),
  }
}

/** The agency terms of the body (agencies only): the rate goes in minor units. */
function agencyBody(values) {
  const rate = String(values.rateAmount).trim()
  return {
    clientId: values.clientId || null,
    showClient: values.showClient,
    startDate: values.startDate || null,
    endDate: values.endDate || null,
    // A remote job pays the rate in the currency picked for it, as its salary.
    rate: rate && RATE.test(rate) ? { amountMinor: Math.round(Number(rate) * 100), period: values.ratePeriod, ...(values.workPreference === 'remote' && { currency: values.salaryCurrency }) } : null,
    hoursPerWeek: toNumber(values.hoursPerWeek),
  }
}
const RATE = /^\d+(\.\d{1,2})?$/

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
    salary: min == null && max == null ? null : { min, max, period: values.salaryPeriod, ...(remote && { currency: values.salaryCurrency }) },
    ...(currentRole() === 'agency' && { agency: agencyBody(values) }),
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
  if (step === 'agency') {
    const A = J.agency
    need('clientId', !values.clientId)
    need('startDate', !values.startDate)
    need('endDate', !values.endDate)
    if (values.startDate && values.endDate && values.endDate < values.startDate) errors.endDate = { key: 'before_start' }
    const rate = String(values.rateAmount).trim()
    if (rate) {
      if (!RATE.test(rate) || Number(rate) <= 0) errors.rateAmount = { key: 'invalid' }
      else if (Math.round(Number(rate) * 100) > A.rate.max) errors.rateAmount = { key: 'too_big', params: { max: A.rate.max / 100 } }
    } else need('rateAmount', true)
    if (!blank(values.hoursPerWeek)) {
      const problem = wholeNumber(values.hoursPerWeek, A.hoursPerWeek)
      if (problem) errors.hoursPerWeek = problem
    }
  }
  return errors
}

/** Every step's errors plus the first step that has one (-1 when none). */
export function validateAll(values, limits) {
  let errors = {}
  let firstStep = -1
  jobSteps().forEach((step, index) => {
    const stepErrors = validateStep(step, values, limits, { publishing: true })
    if (firstStep === -1 && Object.keys(stepErrors).length > 0) firstStep = index
    errors = { ...errors, ...stepErrors }
  })
  return { errors, firstStep }
}

/** A server VALIDATION_FAILED on the job body, as form errors (the body's names map back to the form's). */
export function bodyErrorsToForm(fields) {
  const renamed = {
    'salary.min': 'salaryMin',
    'salary.max': 'salaryMax',
    'salary.currency': 'salaryCurrency',
    salary: 'salaryMin',
    'agency.clientId': 'clientId',
    'agency.startDate': 'startDate',
    'agency.endDate': 'endDate',
    'agency.rate.amountMinor': 'rateAmount',
    'agency.rate.currency': 'rateAmount',
    'agency.hoursPerWeek': 'hoursPerWeek',
    'agency.contract': 'contract',
  }
  return Object.fromEntries(Object.entries(fields).map(([field, error]) => [renamed[field] ?? field.split('.')[0], error]))
}
