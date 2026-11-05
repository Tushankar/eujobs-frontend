import { signedUrl } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { paginate } from '../../lib/pages.js'
import { AppError } from '../../lib/errors.js'
import { Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { photoUrls } from '../candidates/candidates.service.js'
import { logoUrlsById } from '../companies/companies.service.js'
import { Company } from '../companies/companies.model.js'
import { accountRecord } from '../companies/companies.review.js'
import { validRightToWork } from '../discovery/discovery.population.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { Certificate, Course, Enrollment } from '../learning/learning.model.js'
import { isPaid, subscriptionDto } from '../payments/payments.service.js'
import { Subscription } from '../payments/payments.model.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'
import { AuditEvent } from './admin.model.js'
import { searchText } from '../../lib/skills.js'

/*
 * Admin › Candidates and Recruiters (M-161, M-169, M-206): the tables with their filters, the detail pages and the
 * export rows. Data sets are small (P13), so the filters run in Node after one query per collection.
 */
const NAMED_CHECKS = ['identity', 'academic', 'employment']
const RECRUITER_STATE = { unverified: 'pending', onboarding: 'pending', pending_review: 'pending', active: 'approved', rejected: 'rejected', suspended: 'suspended' }
const HISTORY_EVENTS = 20

/**
 * M-169, OQ-6f: Verified = every required check approved (identity; academic and employment when such entries exist);
 * "n of 3 verified" while 1–2 named checks are approved; In review = submissions in review and none approved;
 * otherwise Not started (also when every submission was rejected).
 */
function verificationOf(profile, submissions) {
  const approved = new Set(submissions.filter((s) => s.status === 'approved').map((s) => s.category))
  const required = ['identity', ...(profile?.education.length ? ['academic'] : []), ...(profile?.workHistory.length ? ['employment'] : [])]
  const count = NAMED_CHECKS.filter((category) => approved.has(category)).length
  if (profile && required.every((category) => approved.has(category))) return { state: 'verified', count }
  if (count) return { state: 'partial', count }
  if (submissions.some((s) => s.status === 'in_review')) return { state: 'in_review', count }
  return { state: 'not_started', count }
}

const byUserId = (rows, key = 'userId') => {
  const map = new Map()
  for (const row of rows) map.set(String(row[key]), [...(map.get(String(row[key])) ?? []), row])
  return map
}

async function learningCounts(userIds) {
  const [enrollments, certificates] = await Promise.all([
    Enrollment.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
    Certificate.aggregate([{ $match: { userId: { $in: userIds }, status: 'valid' } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
  ])
  const of = (rows) => new Map(rows.map((row) => [String(row._id), row.count]))
  const enrolled = of(enrollments)
  const certified = of(certificates)
  return (id) => ({ enrolled: enrolled.get(String(id)) ?? 0, certificates: certified.get(String(id)) ?? 0 })
}

const percent = (completeness) => (completeness?.total ? Math.round((completeness.done / completeness.total) * 100) : 0)
const rightToWorkOf = (profile) => (profile?.rightToWork ?? []).map((entry) => ({ region: entry.region, status: entry.status, valid: validRightToWork(entry) }))

async function candidateRows() {
  const users = await User.find({ role: 'candidate' }).sort({ createdAt: -1 })
  const ids = users.map((user) => user._id)
  const [profiles, submissions, subscriptions, learning] = await Promise.all([
    CandidateProfile.find({ userId: { $in: ids } }),
    VerificationSubmission.find({ userId: { $in: ids }, resetAt: null }, 'userId category status'),
    Subscription.find({ userId: { $in: ids } }),
    learningCounts(ids),
  ])
  const profileOf = new Map(profiles.map((profile) => [String(profile.userId), profile]))
  const submissionsOf = byUserId(submissions)
  const paid = new Set(subscriptions.filter(isPaid).map((subscription) => String(subscription.userId)))
  return users.map((user) => {
    const id = String(user._id)
    const profile = profileOf.get(id)
    return {
      id,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      joinedAt: user.createdAt,
      country: profile?.location?.countryCode ?? null,
      rightToWork: rightToWorkOf(profile),
      verification: verificationOf(profile, submissionsOf.get(id) ?? []),
      completeness: percent(profile?.completeness),
      plan: paid.has(id) ? 'plus' : 'free',
      learning: learning(user._id),
    }
  })
}

async function recruiterRows() {
  const users = await User.find({ role: 'recruiter' }).sort({ createdAt: -1 })
  const ids = users.map((user) => user._id)
  const [companies, learning, subscriptions] = await Promise.all([
    Company.find({ ownerUserId: { $in: ids } }, 'ownerUserId displayName location'),
    learningCounts(ids),
    Subscription.find({ userId: { $in: ids } }),
  ])
  const companyOf = new Map(companies.map((company) => [String(company.ownerUserId), company]))
  // P11c-Q17: the Plan column and filter, as on Candidates (M-123).
  const paid = new Set(subscriptions.filter(isPaid).map((subscription) => String(subscription.userId)))
  return users.map((user) => {
    const company = companyOf.get(String(user._id))
    return {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      state: RECRUITER_STATE[user.status],
      joinedAt: user.createdAt,
      company: company ? { id: String(company._id), displayName: company.displayName } : null,
      country: company?.location?.countryCode ?? null,
      plan: paid.has(String(user._id)) ? 'recruiter_plus' : 'free',
      learning: learning(user._id),
    }
  })
}

const matchesText = (row, q) => !q || [row.fullName, row.email, row.company?.displayName].some((text) => searchText(text).includes(searchText(q)))

/** Every row of one table matching the query (search, status or state, country and the candidate filters). */
export async function filteredUsers(query) {
  const rows = query.role === 'candidate' ? await candidateRows() : await recruiterRows()
  return rows.filter(
    (row) =>
      matchesText(row, query.q) &&
      (!query.status || row.status === query.status) &&
      (!query.state || row.state === query.state) &&
      (!query.country || row.country === query.country) &&
      (!query.verification || row.verification.state === query.verification) &&
      (!query.plan || row.plan === query.plan) &&
      (!query.rightToWork ||
        (query.rightToWork === 'none' ? !row.rightToWork.some((entry) => entry.valid) : row.rightToWork.some((entry) => entry.valid && entry.region === query.rightToWork))),
  )
}

/** One table page; each row carries its picture for the viewing admin: the candidate's photo, the recruiter's company logo. */
export async function listUsers(admin, query) {
  const page = paginate(await filteredUsers(query), query)
  if (query.role !== 'candidate') {
    const logos = await logoUrlsById(page.items.map((row) => row.company?.id).filter(Boolean), admin._id)
    return { ...page, items: page.items.map((row) => ({ ...row, photoUrl: logos.get(row.company?.id) ?? null })) }
  }
  const photos = await photoUrls(await CandidateProfile.find({ userId: { $in: page.items.map((row) => row.id) } }, 'userId photo'), admin._id)
  return { ...page, items: page.items.map((row) => ({ ...row, photoUrl: photos.get(row.id) ?? null })) }
}

/** OQ-6d: the export rows in the admin's language, headers first. */
export function exportRows(role, rows, language) {
  const label = (key) => t(language, `labels.${key}`)
  const day = (date) => date.toISOString().slice(0, 10)
  if (role === 'candidate') {
    return [
      t(language, 'csv.candidates'),
      ...rows.map((row) => [
        row.fullName,
        row.email,
        day(row.joinedAt),
        label(`userStatus.${row.status}`),
        row.country ?? '',
        row.rightToWork.filter((entry) => entry.valid).map((entry) => label(`rtwRegion.${entry.region}`)).join('; ') || label('none'),
        label(`verificationState.${row.verification.state}`).replace('{{count}}', row.verification.count),
        row.completeness,
        label(`plan.${row.plan}`),
        row.learning.enrolled,
        row.learning.certificates,
      ]),
    ]
  }
  return [
    t(language, 'csv.recruiters'),
    ...rows.map((row) => [
      row.fullName,
      row.email,
      day(row.joinedAt),
      label(`recruiterState.${row.state}`),
      row.company?.displayName ?? '',
      row.country ?? '',
      label(`plan.${row.plan}`),
      row.learning.enrolled,
      row.learning.certificates,
    ]),
  ]
}

/* ---------- detail pages ---------- */

const historyOf = async (ids) =>
  (await AuditEvent.find({ $or: [{ 'target.id': { $in: ids } }, { 'actor.id': { $in: ids } }] }).sort({ at: -1 }).limit(HISTORY_EVENTS)).map((event) => ({
    id: String(event._id),
    type: event.type,
    category: event.category,
    actor: { type: event.actor.type, name: event.actor.name ?? null },
    params: event.params ?? {},
    at: event.at,
  }))

async function learningOf(userId) {
  const enrollments = await Enrollment.find({ userId }).sort({ enrolledAt: -1 })
  const [courses, certificates] = await Promise.all([
    Course.find({ _id: { $in: enrollments.map((enrollment) => enrollment.courseId) } }, 'title'),
    Certificate.find({ userId }, 'courseId code status'),
  ])
  const titleOf = new Map(courses.map((course) => [String(course._id), course.title]))
  const certificateOf = new Map(certificates.map((certificate) => [String(certificate.courseId), certificate]))
  const items = enrollments.map((enrollment) => {
    const certificate = certificateOf.get(String(enrollment.courseId))
    return {
      courseId: String(enrollment.courseId),
      title: titleOf.get(String(enrollment.courseId)) ?? null,
      source: enrollment.source,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt ?? null,
      certificate: certificate ? { code: certificate.code, status: certificate.status } : null,
    }
  })
  return { enrolled: items.length, certificates: certificates.filter((certificate) => certificate.status === 'valid').length, items }
}

const contactOf = (user) => ({
  id: String(user._id),
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  status: user.status,
  language: user.language,
  joinedAt: user.createdAt,
  lastLoginAt: user.lastLoginAt ?? null,
  emailVerified: Boolean(user.emailVerifiedAt),
  phone: { e164: user.phone?.e164 ?? null, verified: Boolean(user.phone?.verifiedAt) },
})

async function candidateDetail(admin, user) {
  const [profile, submissions, subscription, applications] = await Promise.all([
    CandidateProfile.findOne({ userId: user._id }),
    VerificationSubmission.find({ userId: user._id, resetAt: null }).sort({ submittedAt: -1 }),
    subscriptionDto(user._id),
    Application.find({ candidateId: user._id }).sort({ appliedAt: -1 }),
  ])
  const [jobs, companies, files] = await Promise.all([
    Job.find({ _id: { $in: applications.map((application) => application.jobId) } }, 'title'),
    Company.find({ _id: { $in: applications.map((application) => application.companyId) } }, 'displayName'),
    File.find({ _id: { $in: [profile?.photo?.fileId, ...submissions.map((submission) => submission.fileId)].filter(Boolean) } }),
  ])
  const nameOf = (list, field) => new Map(list.map((doc) => [String(doc._id), doc[field]]))
  const titles = nameOf(jobs, 'title')
  const companyNames = nameOf(companies, 'displayName')
  const fileOf = new Map(files.map((file) => [String(file._id), file]))
  const photo = fileOf.get(String(profile?.photo?.fileId))
  return {
    ...contactOf(user),
    privacy: { discoverable: user.privacy.discoverable, resumeVisible: user.privacy.resumeVisible, matchingConsent: user.privacy.matchingConsent },
    profile: profile && {
      headline: profile.headline ?? '',
      location: profile.location?.placeId ? { countryCode: profile.location.countryCode, city: profile.location.city } : null,
      yearsExperience: profile.yearsExperience ?? null,
      skills: profile.skills.map((skill) => skill.name),
      workPreference: profile.workPreference ?? null,
      availability: profile.availability ?? null,
      photoUrl: photo ? signedUrl(photo, admin._id) : null,
      completeness: { done: profile.completeness?.done ?? 0, total: profile.completeness?.total ?? 0, complete: Boolean(profile.completeness?.complete), percent: percent(profile.completeness) },
      restricted: profile.restricted?.at ? { reason: profile.restricted.reason, at: profile.restricted.at } : null,
    },
    rightToWork: rightToWorkOf(profile),
    verification: {
      ...verificationOf(profile, submissions),
      submissions: submissions.map((submission) => ({
        id: String(submission._id),
        category: submission.category,
        evidenceType: submission.evidenceType ?? null,
        status: submission.status,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt ?? null,
        reason: submission.reason ?? null,
        // Opened through /admin/files with `documents.view` (§2.6); null after the 30-day retention.
        fileId: submission.fileId && fileOf.has(String(submission.fileId)) ? String(submission.fileId) : null,
        fileName: fileOf.get(String(submission.fileId))?.originalName ?? null,
      })),
    },
    plan: { plan: isPaid(subscription) ? subscription.planKey : 'free', subscription },
    applications: applications.map((application) => ({
      id: String(application._id),
      job: { id: String(application.jobId), title: titles.get(String(application.jobId)) ?? null },
      company: companyNames.get(String(application.companyId)) ?? null,
      status: application.status,
      appliedAt: application.appliedAt,
    })),
    learning: await learningOf(user._id),
    history: await historyOf([user._id]),
  }
}

async function recruiterDetail(admin, user) {
  const record = await accountRecord(admin, user)
  const subscription = await subscriptionDto(user._id)
  const companyId = user.companyId
  const [jobs, applications] = companyId
    ? await Promise.all([
        Job.aggregate([{ $match: { companyId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Application.aggregate([{ $match: { companyId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      ])
    : [[], []]
  const total = (rows) => rows.reduce((sum, row) => sum + row.count, 0)
  return {
    ...contactOf(user),
    state: RECRUITER_STATE[user.status],
    jobTitle: record.jobTitle,
    company: record.company,
    documents: record.documents,
    reviewHistory: record.history,
    // P11c-Q8: Recruiter Plus or Free, with the subscription (as on the candidate page).
    plan: { plan: subscription?.paid ? subscription.planKey : 'free', subscription },
    jobs: Object.fromEntries(['published', 'paused', 'draft', 'closed'].map((status) => [status, jobs.find((row) => row._id === status)?.count ?? 0])),
    applications: { total: total(applications), withdrawn: applications.find((row) => row._id === 'withdrawn')?.count ?? 0 },
    learning: await learningOf(user._id),
    history: await historyOf([user._id, companyId].filter(Boolean)),
  }
}

/** GET /admin/users/:id: a candidate or recruiter (admins are listed in Access management only, M-154). */
export async function userDetail(admin, id) {
  const user = await User.findOne({ _id: id, role: { $in: ['candidate', 'recruiter'] } })
  if (!user) throw new AppError('NOT_FOUND')
  return user.role === 'candidate' ? candidateDetail(admin, user) : recruiterDetail(admin, user)
}
