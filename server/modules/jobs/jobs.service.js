import { LIMITS } from '../../config/limits.js'
import { scheduleTask } from '../../jobs/scheduler.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { searchText, skillEntries } from '../../lib/skills.js'
import { validationError } from '../../lib/validate.js'
import { Company } from '../companies/companies.model.js'
import { Country } from '../meta/meta.model.js'
import { refreshRelevantCounts, scheduleRecompute } from '../matching/matching.service.js'
import { resolvePlace } from '../places/places.service.js'
import { Job } from './jobs.model.js'
import { jobBody } from './jobs.schemas.js'

/*
 * Recruiter jobs (§3.7): the wizard draft (M-041), publish validation with the wizard step (M-039), status
 * transitions (M-040, M-167), live edits (M-037), drafts-only delete (M-038), quality checks (M-060),
 * skill suggestions (M-034) and the "N relevant" count (M-051): stored at once from the current scores, then
 * recomputed with the job's new embedding on the next scheduler tick.
 */
const J = LIMITS.job
const QUALITY = { titleWords: 2, briefLength: 120, responsibilities: 3, requiredSkills: { min: 3, max: 8 } }
const SUGGESTIONS = 12

// M-039: the wizard step of each field; a 422 names the first step with an invalid field.
const STEPS = {
  basics: ['title', 'employmentType'],
  responsibilities: ['brief', 'responsibilities'],
  'required-skills': ['requiredSkills'],
  'preferred-skills': ['preferredSkills'],
  experience: ['level', 'experienceYears', 'requiredLanguages'],
  location: ['workPreference', 'placeId', 'remoteCountries', 'salary', 'visaSponsorship'],
}

/** Adds the wizard step to a field error that has none. */
function withStep(error) {
  if (error.code !== 'VALIDATION_FAILED' || error.params?.step) return error
  const fields = Object.keys(error.fields ?? {}).map((field) => field.split('.')[0])
  const step = Object.keys(STEPS).find((name) => STEPS[name].some((field) => fields.includes(field)))
  error.params = { ...error.params, step }
  return error
}

const stepErrors = (work) => async (...args) => {
  try {
    return await work(...args)
  } catch (error) {
    throw withStep(error)
  }
}

function parseJob(body) {
  const result = jobBody.safeParse(body ?? {}, { reportInput: true })
  if (!result.success) throw validationError(result.error.issues)
  return result.data
}

async function allowedCountryCodes() {
  return (await Country.find({ enabled: true, isRemote: false }, 'code')).map((country) => country.code)
}

/** Cross-field rules, the city (G-1) and the salary currency (M-131); formats only, so drafts pass (P4-D7). */
async function jobFields(user, input, existing) {
  const requiredSkills = skillEntries(input.requiredSkills, 'requiredSkills')
  const preferredSkills = skillEntries(input.preferredSkills, 'preferredSkills')
  const both = preferredSkills.find((skill) => requiredSkills.some((required) => required.key === skill.key))
  if (both) throw fieldError({ preferredSkills: 'in_both' }, { skill: both.name })
  const codes = input.requiredLanguages.map((language) => language.code)
  if (new Set(codes).size !== codes.length) throw fieldError({ requiredLanguages: 'duplicate' })

  let country
  let location
  let remoteCountries = []
  if (input.workPreference === 'remote') {
    // OD2, OQ-6i: remote jobs list in the Remote view; an empty eligible list means all EU 27 + UK.
    country = 'REMOTE'
    remoteCountries = [...new Set(input.remoteCountries)]
    const allowed = await allowedCountryCodes()
    if (remoteCountries.some((code) => !allowed.includes(code))) throw fieldError({ remoteCountries: 'invalid' })
  } else if (input.workPreference && input.placeId) {
    location = input.placeId === existing?.location?.placeId ? existing.location : await resolvePlace(input.placeId, user.language)
    country = location.countryCode
  }

  let salary
  const { min = null, max = null, period } = input.salary ?? {}
  if (min !== null || max !== null) {
    if (min !== null && max !== null && max < min) throw fieldError({ 'salary.max': 'below_min' })
    // M-131: locked to the job country's currency; remote jobs use EUR (the REMOTE row's currency).
    const currency = country ? (await Country.findOne({ code: country }, 'currency'))?.currency : undefined
    salary = { min: min ?? undefined, max: max ?? undefined, currency, period }
  }

  return {
    title: input.title,
    employmentType: input.employmentType,
    brief: input.brief,
    responsibilities: input.responsibilities,
    requiredSkills,
    preferredSkills,
    level: input.level ?? undefined,
    experienceYears: input.experienceYears ?? undefined,
    requiredLanguages: input.requiredLanguages,
    visaSponsorship: input.visaSponsorship,
    workPreference: input.workPreference ?? undefined,
    country,
    location,
    remoteCountries,
    salary,
  }
}

/** M-039: what publishing (and a live edit) needs beyond the formats. */
function assertPublishable(job) {
  const fields = {}
  const params = {}
  if (!job.brief) fields.brief = 'required'
  else if (job.brief.length < J.brief.min) {
    fields.brief = 'too_short'
    params.min = J.brief.min
  }
  if (!job.requiredSkills.length) fields.requiredSkills = 'required'
  if (!job.level) fields.level = 'required'
  if (job.experienceYears == null) fields.experienceYears = 'required'
  if (!job.workPreference) fields.workPreference = 'required'
  else if (job.workPreference !== 'remote' && !job.location?.placeId) fields.placeId = 'required'
  if (Object.keys(fields).length) throw fieldError(fields, params)
}

const names = (skills) => skills.map((skill) => skill.name)
const place = (location) => (location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null)

/** A job salary as sent to clients (M-131), or null. */
export const salaryDto = (salary) =>
  salary?.period && (salary.min != null || salary.max != null)
    ? { min: salary.min ?? null, max: salary.max ?? null, currency: salary.currency ?? null, period: salary.period }
    : null

/** The fields every role reads (M-205). */
export function jobFieldsDto(job) {
  return {
    id: String(job._id),
    title: job.title,
    employmentType: job.employmentType,
    brief: job.brief ?? '',
    responsibilities: job.responsibilities,
    requiredSkills: names(job.requiredSkills),
    preferredSkills: names(job.preferredSkills),
    level: job.level ?? null,
    experienceYears: job.experienceYears ?? null,
    requiredLanguages: job.requiredLanguages.map(({ code, minLevel }) => ({ code, minLevel })),
    visaSponsorship: Boolean(job.visaSponsorship),
    workPreference: job.workPreference ?? null,
    country: job.country ?? null,
    location: place(job.location),
    remoteCountries: job.remoteCountries,
    salary: salaryDto(job.salary),
    publishedAt: job.publishedAt ?? null,
  }
}

/** The recruiter's view of a job (M-042: the company is always its display name). */
export function jobDto(job, company) {
  return {
    ...jobFieldsDto(job),
    status: job.status,
    restricted: job.restricted?.at ? { reason: job.restricted.reason, at: job.restricted.at } : null,
    firstPublishedAt: job.firstPublishedAt ?? null,
    closedAt: job.closedAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    relevantCount: job.relevantCount,
    company: { id: String(company._id), displayName: company.displayName },
  }
}

/* ---------- recruiter endpoints ---------- */

async function ownJob(company, id) {
  const job = await Job.findOne({ _id: id, companyId: company._id })
  if (!job) throw new AppError('NOT_FOUND')
  return job
}

/** P9-Q5: every job that is not a draft, newest first, with its company's display name. */
export async function adminJobs() {
  const jobs = await Job.find({ status: { $ne: 'draft' } }).sort({ publishedAt: -1 })
  const companies = new Map((await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } }, 'displayName')).map((company) => [String(company._id), company]))
  const items = jobs.map((job) => jobDto(job, companies.get(String(job.companyId))))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

export async function listJobs(company) {
  const jobs = await Job.find({ companyId: company._id }).sort({ updatedAt: -1 })
  const statusCounts = Object.fromEntries(Job.schema.path('status').enumValues.map((status) => [status, jobs.filter((job) => job.status === status).length]))
  const items = jobs.map((job) => jobDto(job, company))
  return { items, total: items.length, page: 1, pageSize: items.length, statusCounts }
}

export async function getJob(company, id) {
  return jobDto(await ownJob(company, id), company)
}

/** M-041: the wizard's first valid Continue creates the server draft. */
export const createJob = stepErrors(async (user, company, body) => {
  const job = new Job({ companyId: company._id, createdBy: user._id, status: 'draft', ...(await jobFields(user, parseJob(body))) })
  await job.save()
  await refreshRelevantCounts([job])
  return job
})

/** M-037: edits are live; a job that is not a draft must stay publishable. */
export const updateJob = stepErrors(async (user, company, id, body) => {
  const job = await ownJob(company, id)
  job.set(await jobFields(user, parseJob(body), job))
  if (job.status !== 'draft') assertPublishable(job)
  await job.save()
  await refreshRelevantCounts([job])
  if (job.status !== 'draft') await scheduleRecompute('job', job._id)
  return job
})

// M-040: Reopen is closed → published; restricted jobs cannot be published (M-167).
const TRANSITIONS = { draft: ['published'], published: ['paused', 'closed'], paused: ['published', 'closed'], closed: ['published'] }

export const setStatus = stepErrors(async (company, id, status, user) => {
  const job = await ownJob(company, id)
  if (!TRANSITIONS[job.status].includes(status)) throw new AppError('CONFLICT', { params: { status: job.status } })
  const from = job.status
  const now = new Date()
  const firstPublish = status === 'published' && !job.firstPublishedAt
  if (status === 'published') {
    if (job.restricted?.at) throw new AppError('LOCKED', { params: { reason: 'restricted' } })
    assertPublishable(job)
    job.publishedAt = now
    // M-097: only the first publish triggers job alerts.
    job.firstPublishedAt ??= now
    job.closedAt = undefined
  }
  if (status === 'closed') job.closedAt = now
  job.status = status
  await job.save()
  // M-162: recruiter job status changes are user events in the Jobs category (M-163).
  await recordAudit({
    type: 'jobs.status_changed',
    category: 'jobs',
    actor: actorFor(user),
    target: { type: 'job', id: job._id },
    params: { title: job.title, company: company.displayName, from, to: status },
  })
  if (firstPublish) await scheduleTask({ type: 'alerts.instant', key: `alerts.instant:${job._id}`, dueAt: now, payload: { jobId: String(job._id) } })
  await scheduleRecompute('job', job._id)
  return job
})

/** M-038: only drafts can be deleted; published jobs are closed instead. */
export async function deleteJob(company, id) {
  const job = await ownJob(company, id)
  if (job.status !== 'draft') throw new AppError('CONFLICT', { params: { status: job.status } })
  await job.deleteOne()
}

/** M-060: the wizard's "Quality checks" step runs these rules on the server. */
export function qualityChecks(values) {
  const words = (values.title ?? '').split(/\s+/).filter(Boolean).length
  const responsibilities = values.responsibilities?.length ?? 0
  const skills = values.requiredSkills?.length ?? 0
  const { min, max } = QUALITY.requiredSkills
  return [
    { key: 'title_words', ok: words >= QUALITY.titleWords, params: { min: QUALITY.titleWords } },
    { key: 'brief_length', ok: (values.brief ?? '').length >= QUALITY.briefLength, params: { min: QUALITY.briefLength } },
    { key: 'responsibilities', ok: responsibilities >= QUALITY.responsibilities, params: { min: QUALITY.responsibilities, count: responsibilities } },
    { key: 'required_skills', ok: skills >= min && skills <= max, params: { min, max, count: skills } },
    { key: 'salary_range', ok: values.salary?.min != null && values.salary?.max != null, params: {} },
  ]
}

/** P4-D5: the most-used skills of published jobs in the company country, then everywhere. */
export async function skillSuggestions(company, q) {
  const prefix = searchText(q)
  const counted = async (filter) => {
    const counts = new Map()
    for (const job of await Job.find({ status: 'published', ...filter }, 'requiredSkills preferredSkills')) {
      for (const skill of [...job.requiredSkills, ...job.preferredSkills]) {
        if (!searchText(skill.name).startsWith(prefix)) continue
        const entry = counts.get(skill.key) ?? { name: skill.name, count: 0 }
        entry.count += 1
        counts.set(skill.key, entry)
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((entry) => entry.name)
  }
  const local = company.location?.countryCode ? await counted({ country: company.location.countryCode }) : []
  if (local.length >= SUGGESTIONS) return local.slice(0, SUGGESTIONS)
  const everywhere = (await counted({})).filter((name) => !local.some((known) => known.toLocaleLowerCase() === name.toLocaleLowerCase()))
  return [...local, ...everywhere].slice(0, SUGGESTIONS)
}
