import { DateTime } from 'luxon'
import { t } from '../../lib/i18n.js'
import { Application, PipelineStage } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { photoUrls } from '../candidates/candidates.service.js'
import { logoUrls } from '../companies/companies.service.js'
import { Company } from '../companies/companies.model.js'
import { ShortlistEntry } from '../discovery/discovery.model.js'
import { Job } from '../jobs/jobs.model.js'
import { Certificate, Enrollment } from '../learning/learning.model.js'
import { MatchResult } from '../matching/matching.model.js'
import { Conversation } from '../messages/messages.model.js'
import { filteredPayments, paymentStats } from '../payments/payments.admin.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'
import { AuditEvent } from './admin.model.js'
import { eventDto } from './admin.audit.js'
import { filteredUsers } from './admin.users.js'

/*
 * Admin numbers (§3.15, OQ-5, M-170 … M-180, M-138). Everything is counted from the database; a number that also
 * appears on another admin page is computed by that page's own query (Candidates, Recruiters, Payments, Jobs, the
 * verification queue), so the two always agree. KPIs are all-time; only the charts take a period, in the browser
 * time zone with Monday weeks. The country filter follows each subject: a candidate's profile country, a
 * recruiter's or company's company country, a job's country (REMOTE included) and, for applications, the job's.
 */
const TOP_MATCHES = 5
const TOP_SKILLS = 6
const RECENT_EVENTS = 5
const SIDEBAR_ROWS = 5

/** userIds of candidates (profile country) and recruiters (company country) in `country`. */
export async function usersInCountry(country) {
  const [profiles, companies] = await Promise.all([
    CandidateProfile.find({ 'location.countryCode': country }, 'userId'),
    Company.find({ 'location.countryCode': country }, 'ownerUserId'),
  ])
  return [...profiles.map((profile) => profile.userId), ...companies.map((company) => company.ownerUserId)]
}

/** Mongo filters for one country (all empty without a country). */
async function scopeOf(country) {
  if (!country) return { job: {}, application: {}, company: {}, user: {}, companyIds: null }
  const [jobIds, companies, userIds] = await Promise.all([Job.distinct('_id', { country }), Company.distinct('_id', { 'location.countryCode': country }), usersInCountry(country)])
  return {
    job: { country },
    application: { jobId: { $in: jobIds } },
    company: { _id: { $in: companies } },
    user: { userId: { $in: userIds } },
    userIds,
    companyIds: companies,
  }
}

const NOT_WITHDRAWN = { status: { $ne: 'withdrawn' } }

/** M-172, U9: the mean over published jobs of each job's top-5 mean score; roles = the published jobs that have scores. */
async function averageRoleMatch(scope) {
  const jobIds = await Job.distinct('_id', { status: 'published', ...scope.job })
  const tops = await MatchResult.aggregate([
    { $match: { jobId: { $in: jobIds } } },
    { $sort: { score: -1 } },
    { $group: { _id: '$jobId', scores: { $push: '$score' } } },
    { $project: { mean: { $avg: { $slice: ['$scores', TOP_MATCHES] } } } },
  ])
  const value = tops.length ? Math.round(tops.reduce((sum, job) => sum + job.mean, 0) / tops.length) : null
  return { value, roles: jobIds.length }
}

/** The top normalised required skills of the jobs matching `match` (A: admin §1.1), each with how many of them require it. */
export async function demandedSkills(match, limit = TOP_SKILLS) {
  return (
    await Job.aggregate([
      { $match: match },
      { $unwind: '$requiredSkills' },
      { $group: { _id: '$requiredSkills.key', skill: { $first: '$requiredSkills.name' }, roles: { $sum: 1 } } },
      { $sort: { roles: -1, skill: 1 } },
      { $limit: limit },
    ])
  ).map(({ skill, roles }) => ({ skill, roles }))
}

const outreachFilter = (scope) => ({ startedBy: 'recruiter', ...(scope.companyIds && { companyId: { $in: scope.companyIds } }) })

/** GET /admin/overview: the KPIs, the marketplace health counters, the demanded skills and the recent activity. */
export async function overview({ country }) {
  const scope = await scopeOf(country)
  const [candidates, recruiters] = await Promise.all([filteredUsers({ role: 'candidate', country }), filteredUsers({ role: 'recruiter', country })])
  const [published, applications, enrollments, badges, roleMatch, companies, purchases, checks, shortlists, outreach, skills, recent, payments] = await Promise.all([
    Job.countDocuments({ status: 'published', ...scope.job }),
    Application.countDocuments({ ...NOT_WITHDRAWN, ...scope.application }),
    Enrollment.countDocuments(scope.user),
    Certificate.countDocuments({ status: 'valid', ...scope.user }),
    averageRoleMatch(scope),
    Company.countDocuments(scope.company),
    filteredPayments({ status: 'paid', kind: 'course', country }),
    VerificationSubmission.countDocuments({ status: 'in_review', resetAt: null, ...scope.user }),
    ShortlistEntry.countDocuments(scope.companyIds ? { companyId: { $in: scope.companyIds } } : {}),
    Conversation.countDocuments(outreachFilter(scope)),
    demandedSkills({ status: 'published', ...scope.job }),
    AuditEvent.find().sort({ at: -1, _id: -1 }).limit(RECENT_EVENTS),
    paymentStats({ country }),
  ])
  const active = (rows) => rows.filter((row) => row.status === 'active').length
  return {
    kpis: {
      candidateRegistrations: candidates.length,
      activeUsers: active(candidates) + active(recruiters),
      publishedJobs: published,
      applications,
      verifiedProfiles: candidates.filter((row) => row.verification.state === 'verified').length,
      courseEnrollments: enrollments,
      courseBadges: badges,
      averageRoleMatch: roleMatch,
    },
    health: {
      companies,
      coursePurchases: purchases.length,
      checksInReview: checks,
      shortlists,
      outreach,
      pendingReviews: recruiters.filter((row) => row.status === 'pending_review').length,
      // P11c-Q20: the Payments card's count, split by role.
      activeSubscribers: payments.activeSubscribers,
    },
    skills,
    recent: recent.map(eventDto),
  }
}

/** The Overview's "Export report" (OQ-6d): every KPI and health counter, all time, in the admin's language. */
export function overviewExportRows({ kpis, health }, language) {
  const value = (key, number) =>
    key === 'averageRoleMatch' ? (number.value === null ? '' : `${number.value}%`) : key === 'activeSubscribers' ? number.total : number
  return [t(language, 'csv.overview'), ...Object.entries({ ...kpis, ...health }).map(([key, number]) => [t(language, `reports.metrics.${key}`), value(key, number)])]
}

/** GET /admin/analytics (M-175 … M-180, U11, OQ-5): all-time cards and the demanded skills. */
export async function analytics({ country }) {
  const scope = await scopeOf(country)
  const [recruiters, applications, shortlist, companies, outreach, skills] = await Promise.all([
    filteredUsers({ role: 'recruiter', country }),
    Application.find({ ...NOT_WITHDRAWN, ...scope.application }, 'companyId candidateId'),
    ShortlistEntry.find({}, 'companyId candidateId'),
    Company.countDocuments(scope.company),
    Conversation.countDocuments(outreachFilter(scope)),
    demandedSkills({ status: 'published', ...scope.job }),
  ])
  const listed = new Set(shortlist.map((entry) => `${entry.companyId}:${entry.candidateId}`))
  const shortlisted = applications.filter((application) => listed.has(`${application.companyId}:${application.candidateId}`)).length
  return {
    shortlistConversion: { percent: applications.length ? Math.round((shortlisted / applications.length) * 100) : null, shortlisted, applications: applications.length },
    recruiterAccounts: recruiters.length,
    companyRegistrations: companies,
    reviewedOutreach: outreach,
    skills,
  }
}

/* ---------- charts (M-170, M-171, M-177) ---------- */

/** This week, last week (Monday to Sunday) or last month (the calendar month) in `timeZone`. */
export function periodRange(period, timeZone, now = DateTime.now()) {
  const local = now.setZone(timeZone)
  if (period === 'last_month') {
    const start = local.startOf('month').minus({ months: 1 })
    return { start, end: start.plus({ months: 1 }), unit: 'week' }
  }
  const thisWeek = local.startOf('week')
  const start = period === 'last_week' ? thisWeek.minus({ weeks: 1 }) : thisWeek
  return { start, end: start.plus({ weeks: 1 }), unit: 'day' }
}

/** Days of a week, or the month's ISO weeks clipped to the month. */
function bucketsOf({ start, end, unit }) {
  const buckets = []
  for (let cursor = start; cursor < end; ) {
    const next = unit === 'day' ? cursor.plus({ days: 1 }) : DateTime.min(cursor.startOf('week').plus({ weeks: 1 }), end)
    buckets.push({ start: cursor, end: next })
    cursor = next
  }
  return buckets
}

/**
 * Registrations (candidate and recruiter accounts created) and applications sent per bucket. An application counts on
 * the day it was sent, whatever became of it since, as the recruiter momentum chart does.
 */
export async function activity({ period, tz, country }) {
  const range = periodRange(period, tz)
  const scope = await scopeOf(country)
  const window = { $gte: range.start.toJSDate(), $lt: range.end.toJSDate() }
  const [users, applications] = await Promise.all([
    User.find({ role: { $in: ['candidate', 'recruiter'] }, createdAt: window, ...(scope.userIds && { _id: { $in: scope.userIds } }) }, 'createdAt'),
    Application.find({ appliedAt: window, ...scope.application }, 'appliedAt'),
  ])
  const count = (dates, bucket) => dates.filter((date) => date >= bucket.start.toJSDate() && date < bucket.end.toJSDate()).length
  return {
    period,
    timeZone: tz,
    unit: range.unit,
    buckets: bucketsOf(range).map((bucket) => ({
      start: bucket.start.toISODate(),
      end: bucket.end.minus({ days: 1 }).toISODate(),
      registrations: count(users.map((user) => user.createdAt), bucket),
      applications: count(applications.map((application) => application.appliedAt), bucket),
    })),
  }
}

/* ---------- Recruitment (M-178, M-179, M-180, OD5, P10-Q13) ---------- */

/** GET /admin/recruitment: cards, current stage counts, the ever-reached funnel, the movement rows and the side lists. */
export async function recruitment(admin, { country }) {
  const scope = await scopeOf(country)
  const applications = await Application.find({ ...NOT_WITHDRAWN, ...scope.application }).sort({ appliedAt: -1 })
  const candidateIds = applications.map((application) => application.candidateId)
  const [stages, jobs, users, profiles, shortlist, conversations, published, recentJobs] = await Promise.all([
    PipelineStage.find({ _id: { $in: applications.map((application) => application.stageId) } }, 'category name'),
    Job.find({ _id: { $in: applications.map((application) => application.jobId) } }, 'title companyId'),
    User.find({ _id: { $in: candidateIds } }, 'fullName'),
    CandidateProfile.find({ userId: { $in: candidateIds } }, 'userId photo'),
    ShortlistEntry.find({}, 'companyId candidateId'),
    Conversation.find({ startedBy: 'recruiter' }, 'companyId candidateId'),
    Job.countDocuments({ status: 'published', ...scope.job }),
    Job.find({ status: 'published', ...scope.job }).sort({ publishedAt: -1 }).limit(SIDEBAR_ROWS),
  ])
  const companyDocs = await Company.find({ _id: { $in: [...jobs, ...recentJobs].map((job) => job.companyId) } }, 'displayName logoFileId')
  const companies = new Map(companyDocs.map((company) => [String(company._id), company.displayName]))
  const [photos, logos] = await Promise.all([photoUrls(profiles, admin._id), logoUrls(companyDocs, admin._id)])
  const byId = (rows) => new Map(rows.map((row) => [String(row._id), row]))
  const stageOf = byId(stages)
  const jobOf = byId(jobs)
  const userOf = byId(users)
  const pair = (row) => `${row.companyId}:${row.candidateId}`
  const listed = new Set(shortlist.map(pair))
  const contacted = new Set(conversations.map(pair))
  const scopedShortlist = scope.companyIds ? shortlist.filter((entry) => scope.companyIds.some((id) => id.equals(entry.companyId))) : shortlist
  const scopedOutreach = scope.companyIds ? conversations.filter((item) => scope.companyIds.some((id) => id.equals(item.companyId))) : conversations

  const CATEGORIES = PipelineStage.schema.path('category').enumValues
  const current = Object.fromEntries(CATEGORIES.map((category) => [category, 0]))
  const reached = Object.fromEntries(CATEGORIES.map((category) => [category, 0]))
  for (const application of applications) {
    const category = stageOf.get(String(application.stageId))?.category
    if (category) current[category] += 1
    for (const step of new Set(application.history.map((entry) => entry.category).filter(Boolean))) reached[step] += 1
  }
  const movement = applications.map((application) => {
    const job = jobOf.get(String(application.jobId))
    return {
      id: String(application._id),
      candidate: { id: String(application.candidateId), name: userOf.get(String(application.candidateId))?.fullName ?? null, photoUrl: photos.get(String(application.candidateId)) ?? null },
      job: { id: String(application.jobId), title: job?.title ?? null },
      company: companies.get(String(application.companyId)) ?? null,
      companyId: String(application.companyId),
      companyLogoUrl: logos.get(String(application.companyId)) ?? null,
      category: stageOf.get(String(application.stageId))?.category ?? null,
      stageName: stageOf.get(String(application.stageId))?.name ?? null,
      status: application.status,
      appliedAt: application.appliedAt,
      shortlisted: listed.has(pair(application)),
      outreach: contacted.has(pair(application)),
    }
  })
  return {
    stats: { publishedRoles: published, applications: applications.length, shortlisted: scopedShortlist.length, reviewedOutreach: scopedOutreach.length },
    stages: CATEGORIES.map((category) => ({ category, count: current[category] })),
    funnel: CATEGORIES.map((category) => ({ category, count: reached[category] })),
    movement,
    roles: recentJobs.map((job) => ({
      id: String(job._id),
      title: job.title,
      company: companies.get(String(job.companyId)) ?? null,
      companyId: String(job.companyId),
      companyLogoUrl: logos.get(String(job.companyId)) ?? null,
      workPreference: job.workPreference,
      country: job.country,
      city: job.location?.city ?? null,
    })),
    coverage: movement.slice(0, SIDEBAR_ROWS),
  }
}
