import { AppError } from '../../lib/errors.js'
import { t } from '../../lib/i18n.js'
import { matchesKeywords, searchText, skillOverlap } from '../../lib/skills.js'
import { Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls, publicCompanyDto } from '../companies/companies.service.js'
import { ProfileView } from '../discovery/discovery.model.js'
import { relevantPair, resultsBy } from '../matching/matching.service.js'
import { Country } from '../meta/meta.model.js'
import { planState } from '../payments/payments.service.js'
import { User } from '../users/users.model.js'
import { Job, SavedJob } from './jobs.model.js'
import { jobFieldsDto } from './jobs.service.js'

/*
 * Candidate job browsing (§3.8, M-043, M-044, M-052, M-053 with U8, M-137, OD2, U25, P4-Q4). The header
 * country picks the view; every candidate sees the skill-overlap label (M-050). Plus candidates with matching consent
 * also see the score and label (C6) and get For you and Recommended ranked by score.
 */
const DAY_MS = 24 * 60 * 60 * 1000

/** M-044: companies whose recruiter is approved and not suspended. */
async function visibleCompanyIds() {
  return (await User.find({ role: 'recruiter', status: 'active', companyId: { $ne: null } }, 'companyId')).map((user) => user.companyId)
}

/** Published, not restricted (M-167), from an approved recruiter. */
export async function visibleFilter() {
  return { status: 'published', 'restricted.at': null, companyId: { $in: await visibleCompanyIds() } }
}

/** OD2: the Remote view lists remote jobs; a country view lists the on-site and hybrid jobs located there. */
export const viewFilter = (country) => (country === 'REMOTE' ? { country: 'REMOTE' } : { country, workPreference: { $in: ['on_site', 'hybrid'] } })
const viewOf = (user) => user.pickerCountry ?? 'REMOTE'

/** U25: a monthly salary counts ×12; P4-Q4: the top end of the range (the minimum when there is no maximum). */
const annualTop = (salary) => {
  const amount = salary?.max ?? salary?.min
  return amount == null ? null : amount * (salary.period === 'month' ? 12 : 1)
}

/** Everything a card needs for these jobs and this candidate: companies, logos, profile skills, saved ids. */
async function cardContext(user, jobs) {
  const companies = await Company.find({ _id: { $in: [...new Set(jobs.map((job) => String(job.companyId)))] } })
  const logos = await logoUrls(companies, user._id)
  const byId = new Map(companies.map((company) => [String(company._id), company]))
  // Owner decision P10-Q8: "Verified company" while the company is approved and its recruiter is active (not suspended).
  const activeOwners = new Set((await User.find({ _id: { $in: companies.map((company) => company.ownerUserId) }, status: 'active' }, '_id')).map((owner) => String(owner._id)))
  const verified = (company) => Boolean(company.verifiedAt) && activeOwners.has(String(company.ownerUserId))
  const profile = await CandidateProfile.findOne({ userId: user._id }, 'skills')
  const saved = new Set((await SavedJob.find({ candidateId: user._id, jobId: { $in: jobs.map((job) => job._id) } }, 'jobId')).map((entry) => String(entry.jobId)))
  const applied = new Map(
    (await Application.find({ candidateId: user._id, jobId: { $in: jobs.map((job) => job._id) }, status: { $ne: 'withdrawn' } }, 'jobId status')).map((application) => [String(application.jobId), { id: String(application._id), status: application.status }]),
  )
  const skills = profile?.skills ?? []
  const scored = user.privacy?.matchingConsent && (await planState(user._id)).entitlements.includes('ai')
  const results = scored ? await resultsBy({ candidateId: user._id }, jobs.map((job) => job._id)) : new Map()
  const result = (job) => results.get(String(job._id)) ?? null
  return {
    scored,
    company: (job) => byId.get(String(job.companyId)),
    overlap: (job) => skillOverlap(skills, job),
    // M-051: a score ≥ Good, or at least 1 required skill when the pair has no score (U8 for Free).
    relevant: (job) => relevantPair(job, { skills }, result(job)),
    // Scored jobs first by score, then by overlap and recency (U8).
    byScore: (a, b) => (result(b)?.score ?? -1) - (result(a)?.score ?? -1) || skillOverlap(skills, b).matched.length - skillOverlap(skills, a).matched.length || newest(a, b),
    card(job) {
      const company = byId.get(String(job.companyId))
      const { matched, total } = skillOverlap(skills, job)
      return {
        ...jobFieldsDto(job),
        company: { ...publicCompanyDto(company, logos.get(String(company._id))), verified: verified(company) },
        saved: saved.has(String(job._id)),
        // The candidate's own active application to this job (Phase 6); the Apply button reads it.
        application: applied.get(String(job._id)) ?? null,
        // M-052: one overlap definition and label for everyone.
        overlap: { matched, count: matched.length, total },
        match: result(job) ? { score: result(job).score, label: result(job).label ?? null } : null,
      }
    },
  }
}

/** Job cards for any jobs of this candidate's (AI insights role picker, M-063). */
export async function jobCards(user, jobs) {
  const context = await cardContext(user, jobs)
  return jobs.map((job) => context.card(job))
}

/** §3.6 keywords: title, company, skills, city, work mode, level or industry; labels in the user's language. */
export function haystack(job, company, language) {
  return searchText(
    [
      job.title,
      company.displayName,
      company.industry,
      ...job.requiredSkills.map((skill) => skill.name),
      ...job.preferredSkills.map((skill) => skill.name),
      job.location?.city,
      job.workPreference && t(language, `labels.workPreference.${job.workPreference}`),
      job.level && t(language, `labels.jobLevel.${job.level}`),
    ].join(' '),
  )
}

const newest = (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)

/** GET /jobs: the view's jobs with filters and sort (all rows, §2.3). */
export async function searchJobs(user, query) {
  const view = viewOf(user)
  const jobs = await Job.find({ ...(await visibleFilter()), ...viewFilter(view) })
  const context = await cardContext(user, jobs)
  const kept = jobs.filter((job) => {
    if (query.workPreference.length && !query.workPreference.includes(job.workPreference)) return false
    if (query.level.length && !query.level.includes(job.level)) return false
    if (query.placeId && job.location?.placeId !== query.placeId) return false
    if (query.eligible && view === 'REMOTE' && job.remoteCountries.length && !job.remoteCountries.includes(query.eligible)) return false
    if (query.salaryMin != null && !(annualTop(job.salary) >= query.salaryMin)) return false
    return !query.q || matchesKeywords(query.q, haystack(job, context.company(job), user.language))
  })
  const sorters = {
    recommended: context.byScore,
    newest,
    salary: (a, b) => (annualTop(b.salary) ?? -1) - (annualTop(a.salary) ?? -1) || newest(a, b),
  }
  const items = kept.sort(sorters[query.sort]).map((job) => context.card(job))
  const currency = (await Country.findOne({ code: view }, 'currency'))?.currency ?? null
  return { items, total: items.length, page: 1, pageSize: items.length, view: { country: view, currency } }
}

/** M-053: Plus = jobs with a score ≥ Good, ranked; U8 (Free, and pairs without a score): at least 1 required skill. */
export async function recommendedJobs(user, now = Date.now()) {
  const jobs = await Job.find({ ...(await visibleFilter()), ...viewFilter(viewOf(user)) })
  const context = await cardContext(user, jobs)
  const items = jobs.filter(context.relevant).sort(context.byScore)
  // M-053: "+N this week" = published in the last 7 days.
  const newThisWeek = items.filter((job) => job.publishedAt && job.publishedAt.getTime() >= now - 7 * DAY_MS).length
  return { items: items.map((job) => context.card(job)), total: items.length, newThisWeek, byScore: Boolean(context.scored) }
}

export async function isVisible(job) {
  return Boolean(await Job.exists({ _id: job._id, ...(await visibleFilter()) }))
}

/** M-043: savers and applicants of a paused, closed or hidden job see it as no longer accepting; everyone else gets 404. */
export async function jobDetails(user, id) {
  const job = await Job.findById(id)
  if (!job || job.status === 'draft') throw new AppError('NOT_FOUND')
  const accepting = await isVisible(job)
  if (!accepting && !(await SavedJob.exists({ candidateId: user._id, jobId: job._id })) && !(await Application.exists({ candidateId: user._id, jobId: job._id }))) throw new AppError('NOT_FOUND')
  return { ...(await cardContext(user, [job])).card(job), accepting }
}

/** M-065: saved jobs, newest first; jobs that stopped accepting stay listed with that state. */
export async function savedJobs(user) {
  const entries = await SavedJob.find({ candidateId: user._id }).sort({ createdAt: -1 })
  const jobs = await Job.find({ _id: { $in: entries.map((entry) => entry.jobId) }, status: { $ne: 'draft' } })
  const visible = new Set((await Job.find({ _id: { $in: jobs.map((job) => job._id) }, ...(await visibleFilter()) }, '_id')).map((job) => String(job._id)))
  const byId = new Map(jobs.map((job) => [String(job._id), job]))
  const ordered = entries.map((entry) => byId.get(String(entry.jobId))).filter(Boolean)
  const context = await cardContext(user, ordered)
  const items = ordered.map((job) => ({ ...context.card(job), accepting: visible.has(String(job._id)) }))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

export async function saveJob(user, jobId) {
  const job = await Job.findById(jobId)
  if (!job || !(await isVisible(job))) throw new AppError('NOT_FOUND')
  await SavedJob.updateOne({ candidateId: user._id, jobId: job._id }, { $setOnInsert: { candidateId: user._id, jobId: job._id } }, { upsert: true })
}

export function unsaveJob(user, jobId) {
  return SavedJob.deleteOne({ candidateId: user._id, jobId })
}

/** GET /candidate/overview: Recommended jobs (M-053), saved jobs and profile views (M-184). */
export async function candidateOverview(user, now = Date.now()) {
  const recommended = await recommendedJobs(user, now)
  const [savedCount, last30, previous30] = await Promise.all([
    SavedJob.countDocuments({ candidateId: user._id }),
    ProfileView.countDocuments({ candidateId: user._id, at: { $gte: new Date(now - 30 * DAY_MS) } }),
    ProfileView.countDocuments({ candidateId: user._id, at: { $gte: new Date(now - 60 * DAY_MS), $lt: new Date(now - 30 * DAY_MS) } }),
  ])
  return { recommended: { count: recommended.total, newThisWeek: recommended.newThisWeek, byScore: recommended.byScore }, savedJobs: savedCount, profileViews: { last30, previous30 } }
}
