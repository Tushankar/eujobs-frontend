import { LIMITS } from '../../config/limits.js'
import { scheduleTask } from '../../jobs/scheduler.js'
import { addStandardNames } from '../../lib/ai.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { actorFor, recordAudit, SYSTEM_ACTOR } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { paginate } from '../../lib/pages.js'
import { searchText, skillEntries } from '../../lib/skills.js'
import { validationError } from '../../lib/validate.js'
import { Company } from '../companies/companies.model.js'
import { logoUrlsById } from '../companies/companies.service.js'
import { File } from '../files/files.model.js'
import { Country } from '../meta/meta.model.js'
import { ModerationCase } from '../moderation/moderation.model.js'
import { planState } from '../payments/payments.service.js'
import { refreshRelevantCounts, scheduleRecompute } from '../matching/matching.service.js'
import { resolvePlace } from '../places/places.service.js'
import { AgencyClient } from '../agencies/agencies.model.js'
import { checkedRules, EMPTY_RULES, readRules, rulesDto } from '../agencies/contracts.js'
import { Job } from './jobs.model.js'
import { agencyTermsBody, jobBody } from './jobs.schemas.js'

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
  // 2026-11-20: agency jobs only
  agency: ['agency'],
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

/**
 * M-131: a job's pay is in the job country's currency. A remote job pays in the currency the recruiter picks (any
 * enabled country's, 2026-11-16), EUR (the REMOTE row's) when none is picked. `field` names the error.
 */
async function payCurrency(country, chosen, field) {
  if (country === 'REMOTE' && chosen) {
    if (!(await Country.exists({ currency: chosen, enabled: true }))) throw fieldError({ [field]: 'invalid' })
    return chosen
  }
  return country ? (await Country.findOne({ code: country }, 'currency'))?.currency : undefined
}

// 2026-11-20: an agency job is full or part time (its length is in its dates).
const AGENCY_EMPLOYMENT = ['full_time', 'part_time']

/** An agency job's terms (2026-11-20): the agency's own client, dates in order, the rate in the job's pay currency. */
async function agencyTerms(user, input, country, existing) {
  if (user.role !== 'agency') {
    if (input.agency) throw fieldError({ agency: 'not_allowed' })
    return undefined
  }
  if (!AGENCY_EMPLOYMENT.includes(input.employmentType)) throw fieldError({ employmentType: 'not_allowed' })
  const terms = input.agency ?? agencyTermsBody.parse({})
  if (terms.clientId && !(await AgencyClient.exists({ _id: terms.clientId, companyId: user.companyId }))) throw fieldError({ 'agency.clientId': 'invalid' })
  if (terms.startDate && terms.endDate && terms.endDate < terms.startDate) throw fieldError({ 'agency.endDate': 'before_start' })
  const { amountMinor = null, period, currency: chosen } = terms.rate ?? {}
  return {
    clientId: terms.clientId ?? undefined,
    showClient: terms.showClient,
    startDate: terms.startDate ?? undefined,
    endDate: terms.endDate ?? undefined,
    rate: amountMinor !== null ? { amountMinor, period, currency: await payCurrency(country, chosen, 'agency.rate.currency') } : undefined,
    hoursPerWeek: terms.hoursPerWeek ?? undefined,
    // Attached and removed through its own endpoints.
    contract: existing?.agency?.contract,
  }
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
  await addStandardNames([...requiredSkills, ...preferredSkills], user)
  const codes = input.requiredLanguages.map((language) => language.code)
  if (new Set(codes).size !== codes.length) throw fieldError({ requiredLanguages: 'duplicate' })

  let country
  let location
  let remoteCountries = []
  if (input.workPreference === 'remote') {
    // OD2, OQ-6i: remote jobs list in the Remote view; an empty eligible list means open worldwide (2026-11-16).
    country = 'REMOTE'
    remoteCountries = [...new Set(input.remoteCountries)]
    const allowed = await allowedCountryCodes()
    if (remoteCountries.some((code) => !allowed.includes(code))) throw fieldError({ remoteCountries: 'invalid' })
  } else if (input.workPreference && input.placeId) {
    location = input.placeId === existing?.location?.placeId ? existing.location : await resolvePlace(input.placeId, user.language)
    country = location.countryCode
  }

  let salary
  const { min = null, max = null, period, currency: chosen } = input.salary ?? {}
  if (min !== null || max !== null) {
    if (min !== null && max !== null && max < min) throw fieldError({ 'salary.max': 'below_min' })
    salary = { min: min ?? undefined, max: max ?? undefined, currency: await payCurrency(country, chosen, 'salary.currency'), period }
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
    agency: await agencyTerms(user, input, country, existing),
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
  // 2026-11-20: an agency job needs its client, both dates and the pay rate.
  if (job.agency) {
    for (const field of ['clientId', 'startDate', 'endDate']) if (!job.agency[field]) fields[`agency.${field}`] = 'required'
    if (!job.agency.rate?.amountMinor) fields['agency.rate.amountMinor'] = 'required'
    // An attached contract counts only with its rules confirmed.
    if (job.agency.contract?.fileId && !job.agency.contract.confirmedAt) fields['agency.contract'] = 'rules_unconfirmed'
  }
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
    agency: agencyDto(job.agency),
    publishedAt: job.publishedAt ?? null,
  }
}

const contractDto = (contract) => ({
  name: contract.name,
  size: contract.size,
  uploadedAt: contract.uploadedAt,
  rules: rulesDto(contract.rules),
  aiRules: contract.aiReadAt ? rulesDto(contract.aiRules) : null,
  aiReadAt: contract.aiReadAt ?? null,
  confirmedAt: contract.confirmedAt ?? null,
})

/** 2026-11-20: an agency job's terms as every role reads them (the client itself only where it may be shown), or null. */
function agencyDto(terms) {
  if (!terms) return null
  return {
    showClient: terms.showClient,
    startDate: terms.startDate ?? null,
    endDate: terms.endDate ?? null,
    rate: terms.rate?.amountMinor ? { amountMinor: terms.rate.amountMinor, currency: terms.rate.currency ?? null, period: terms.rate.period } : null,
    hoursPerWeek: terms.hoursPerWeek ?? null,
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
    // The agency's own view also has the client and the attached contract (2026-11-20).
    ...(job.agency && {
      agency: {
        ...agencyDto(job.agency),
        clientId: job.agency.clientId ? String(job.agency.clientId) : null,
        contract: job.agency.contract?.fileId ? contractDto(job.agency.contract) : null,
      },
    }),
  }
}

/* ---------- recruiter endpoints ---------- */

async function ownJob(company, id) {
  const job = await Job.findOne({ _id: id, companyId: company._id })
  if (!job) throw new AppError('NOT_FOUND')
  return job
}

/**
 * Admin › Jobs (M-046, P9-Q5, P10-Q4, P10-Q15): every job of every status, newest first, with its company's display
 * name and its open moderation case; filtered by status, country (`job.country`, REMOTE included) and a search in
 * the title and company, server-paginated.
 */
export async function adminJobs(admin, { q, status, country, ...page }) {
  const jobs = await Job.find({ ...(status && { status }), ...(country && { country }) }).sort({ publishedAt: -1, createdAt: -1 })
  const companies = new Map((await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } }, 'displayName')).map((company) => [String(company._id), company]))
  const needle = q && searchText(q)
  // A job whose company no longer exists is not listed (nothing can be done with it).
  const listed = jobs.filter((job) => companies.has(String(job.companyId)))
  const matching = needle ? listed.filter((job) => [job.title, companies.get(String(job.companyId)).displayName].some((text) => searchText(text).includes(needle))) : listed
  const result = paginate(matching, page)
  const [found, logos] = await Promise.all([
    ModerationCase.find({ targetType: 'job', targetId: { $in: result.items.map((job) => job._id) }, status: 'open' }, 'targetId'),
    logoUrlsById(result.items.map((job) => job.companyId), admin._id),
  ])
  const cases = new Map(found.map((item) => [String(item.targetId), String(item._id)]))
  return {
    ...result,
    items: result.items.map((job) => {
      const dto = jobDto(job, companies.get(String(job.companyId)))
      return { ...dto, company: { ...dto.company, logoUrl: logos.get(String(job.companyId)) ?? null }, openCaseId: cases.get(String(job._id)) ?? null }
    }),
  }
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
    // §3.22, P11c-Q3, Q5: without Recruiter Plus a company keeps 1 published job.
    if ((await Job.exists({ companyId: company._id, status: 'published', _id: { $ne: job._id } })) && !(await planState(user._id)).entitlements.includes('jobs_unlimited')) {
      throw new AppError('PLAN_REQUIRED', { params: { entitlement: 'jobs_unlimited' } })
    }
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

/**
 * §3.22, P11c-Q6: without Recruiter Plus only the most recently published job stays live; the others are paused (a
 * system change) and can be republished after subscribing again. Returns the job kept and the number paused.
 */
export async function pauseExtraJobs(company) {
  const [kept, ...extra] = await Job.find({ companyId: company._id, status: 'published' }).sort({ publishedAt: -1, _id: -1 })
  for (const job of extra) {
    job.status = 'paused'
    await job.save()
    await recordAudit({
      type: 'jobs.status_changed',
      category: 'jobs',
      actor: SYSTEM_ACTOR,
      target: { type: 'job', id: job._id },
      params: { title: job.title, company: company.displayName, from: 'published', to: 'paused' },
    })
    await scheduleRecompute('job', job._id)
  }
  return { kept: kept ?? null, paused: extra.length }
}

/** P11c-Q12: at start, recruiters without Recruiter Plus who have more than 1 published job get the plan-end rule. */
export async function enforceFreeJobLimit() {
  const over = await Job.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }])
  for (const { _id } of over) {
    const company = await Company.findById(_id, 'ownerUserId displayName')
    if (company && !(await planState(company.ownerUserId)).entitlements.includes('jobs_unlimited')) await pauseExtraJobs(company)
  }
}

/* ---------- 2026-11-20: an agency job's contract PDF ---------- */

async function ownAgencyJob(company, id) {
  const job = await ownJob(company, id)
  if (!job.agency) throw new AppError('NOT_FOUND')
  return job
}

/** One contract per job; a new upload replaces the earlier file. */
export async function setContract(user, company, id, upload) {
  const job = await ownAgencyJob(company, id)
  const file = await storeFile({ ownerId: user._id, purpose: 'agency_contract', buffer: upload.buffer, ext: upload.ext, originalName: upload.originalname })
  const previous = job.agency.contract?.fileId
  // A new PDF starts with no rules; they are read or typed and confirmed again.
  job.agency.contract = { fileId: file._id, name: upload.originalname, size: file.size, uploadedAt: new Date(), rules: EMPTY_RULES }
  await job.save()
  await removeFiles([previous])
  return job
}

export async function removeContract(company, id) {
  const job = await ownAgencyJob(company, id)
  const previous = job.agency.contract?.fileId
  job.agency.contract = undefined
  await job.save()
  await removeFiles([previous])
  return job
}

function attachedContract(job) {
  if (!job.agency.contract?.fileId) throw new AppError('NOT_FOUND')
  return job.agency.contract
}

/** POST /recruiter/jobs/:id/contract/read (Agency Plus): AI proposes the contract's rules, to check and confirm. */
export async function readContract(user, company, id) {
  const job = await ownAgencyJob(company, id)
  const contract = attachedContract(job)
  const rules = await readRules(user, contract.fileId)
  Object.assign(contract, { rules, aiRules: rules, aiReadAt: new Date(), confirmedAt: undefined })
  await job.save()
  return job
}

/** PUT /recruiter/jobs/:id/contract/rules: the agency's rules (typed or corrected), confirmed. */
export async function confirmContractRules(company, id, body) {
  const job = await ownAgencyJob(company, id)
  const contract = attachedContract(job)
  Object.assign(contract, { rules: await checkedRules(contract.fileId, body), confirmedAt: new Date() })
  await job.save()
  return job
}

/** GET /recruiter/jobs/:id/contract: a signed URL for the agency (U39). */
export async function contractUrl(user, company, id) {
  const job = await ownAgencyJob(company, id)
  const file = job.agency.contract?.fileId && (await File.findById(job.agency.contract.fileId))
  if (!file) throw new AppError('NOT_FOUND')
  return { url: signedUrl(file, user._id), name: job.agency.contract.name }
}

/** M-038: only drafts can be deleted; published jobs are closed instead. */
export async function deleteJob(company, id) {
  const job = await ownJob(company, id)
  if (job.status !== 'draft') throw new AppError('CONFLICT', { params: { status: job.status } })
  await job.deleteOne()
  await removeFiles([job.agency?.contract?.fileId])
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
