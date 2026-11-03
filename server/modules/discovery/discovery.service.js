import { config } from '../../config/env.js'
import { ENUMS } from '../../config/enums.js'
import { AppError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { matchesKeywords, searchText, skillKey, skillOverlap } from '../../lib/skills.js'
import { ACTIVE_FILTER, Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { CvAccessRequest, CvVersion } from '../cv/cv.model.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { badgesOf } from '../learning/learning.certificates.js'
import { relevantCandidates, resultsBy } from '../matching/matching.service.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'
import { CandidateNote, ProfileView, RecruiterActivity, ShortlistEntry } from './discovery.model.js'
import { hasRightToWorkIn, inMarket, listableCandidates, marketCandidates, validRightToWork } from './discovery.population.js'

/*
 * Recruiter discovery (§3.8): Find candidates with the M-055 country rule and the M-056 filters, the candidate
 * profile (M-026, M-168, P4-D11) with profile views (M-184), the shortlist (M-079), notes (M-080), the activity
 * timeline (M-081), and CV access and earlier-version requests (M-029, M-187, P4-D12). Recommended ranks by the
 * match score (M-047), then the M-052 skill overlap; recruiters never see a score (C6), so no answer carries one.
 */
const LEVELS = ENUMS.languageLevel
const TALENT_CARDS = 3
const RELEVANT_TALENT = 4

/* ---------- activity ---------- */

export function recordActivity({ companyId, candidateId, actorId, type, params }) {
  return RecruiterActivity.create({ companyId, candidateId, actorId, type, params })
}

/** P4-D13: a new live CV is shown to the companies that shortlisted, noted or requested this candidate. */
export async function recordCvUpdated(candidateId, versionNumber) {
  const lists = await Promise.all([ShortlistEntry, CandidateNote, CvAccessRequest].map((Model) => Model.distinct('companyId', { candidateId })))
  const companies = [...new Set(lists.flat().map(String))]
  await RecruiterActivity.insertMany(companies.map((companyId) => ({ companyId, candidateId, type: 'cv_updated', params: { version: versionNumber } })))
}

/* ---------- cards and profiles ---------- */

const place = (location) => (location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null)
const latest = (entries, ongoing) =>
  [...entries].sort((a, b) => Number(Boolean(b[ongoing])) - Number(Boolean(a[ongoing])) || (b.end ?? b.start).localeCompare(a.end ?? a.start))

/** M-023, OQ-6f: identity always; academic and employment when such an entry exists. */
function verificationOf(profile, approved) {
  const checks = { identity: approved.has('identity'), academic: approved.has('academic'), employment: approved.has('employment') }
  const required = ['identity', ...(profile.education.length ? ['academic'] : []), ...(profile.workHistory.length ? ['employment'] : [])]
  const count = required.filter((category) => checks[category]).length
  return { checks, required: required.length, count, verified: count === required.length }
}

/** Approved, not reset submissions per candidate: categories and the approved certificate entries (M-025). */
async function approvalsFor(userIds) {
  const submissions = await VerificationSubmission.find({ userId: { $in: userIds }, status: 'approved', resetAt: null }, 'userId category entryId')
  const byUser = new Map(userIds.map((id) => [String(id), { categories: new Set(), certificates: new Set() }]))
  for (const submission of submissions) {
    const entry = byUser.get(String(submission.userId))
    entry.categories.add(submission.category)
    if (submission.category === 'certificate') entry.certificates.add(String(submission.entryId))
  }
  return byUser
}

/** Everything a candidate card needs for one company, over many candidates (§3.8, A: recruiter B2). */
async function cardContext(viewer, company, entries, job) {
  const userIds = entries.map(({ user }) => user._id)
  const [approvals, shortlist, photos] = await Promise.all([
    approvalsFor(userIds),
    ShortlistEntry.find({ companyId: company._id, candidateId: { $in: userIds } }, 'candidateId'),
    File.find({ _id: { $in: entries.map(({ profile }) => profile.photo?.fileId).filter(Boolean) } }),
  ])
  const shortlisted = new Set(shortlist.map((entry) => String(entry.candidateId)))
  const photoById = new Map(photos.map((file) => [String(file._id), file]))
  return ({ user, profile }) => {
    const approved = approvals.get(String(user._id))
    const photo = profile.photo?.fileId && photoById.get(String(profile.photo.fileId))
    const [role] = latest(profile.workHistory, 'current')
    const [study] = latest(profile.education, 'stillStudying')
    const overlap = job && skillOverlap(profile.skills, job)
    return {
      id: String(user._id),
      fullName: user.fullName,
      photoUrl: photo ? signedUrl(photo, viewer._id) : null,
      headline: profile.headline,
      location: place(profile.location),
      workPreference: profile.workPreference,
      yearsExperience: profile.yearsExperience,
      availability: profile.availability,
      skills: profile.skills.map((skill) => skill.name),
      languages: profile.languages.map(({ code, level }) => ({ code, level })),
      rightToWork: profile.rightToWork.map(({ region, status, permitExpiresOn }) => ({ region, status, permitExpiresOn: permitExpiresOn ?? null, valid: validRightToWork({ status, permitExpiresOn }) })),
      currentRole: role ? { title: role.title, employer: role.employer, start: role.start, end: role.end ?? null, current: Boolean(role.current) } : null,
      latestEducation: study ? { degree: study.degree, institution: study.institution, end: study.end ?? null } : null,
      certificates: profile.certificates.map((certificate) => ({ name: certificate.name, issuer: certificate.issuer, verified: approved.certificates.has(String(certificate._id)) })),
      verification: verificationOf(profile, approved.categories),
      shortlisted: shortlisted.has(String(user._id)),
      overlap: overlap ? { matched: overlap.matched, missing: overlap.missing, count: overlap.matched.length } : null,
      updatedAt: profile.updatedAt,
    }
  }
}

/** The job used for overlap: the chosen one of this company, else its newest published job (P4-D10). */
async function matchJob(company, jobId) {
  if (jobId) return Job.findOne({ _id: jobId, companyId: company._id })
  return Job.findOne({ companyId: company._id, status: 'published' }).sort({ publishedAt: -1 })
}

const viewOf = (user) => user.pickerCountry ?? 'REMOTE'
const levelAtLeast = (level, minimum) => LEVELS.indexOf(level) >= LEVELS.indexOf(minimum)

function searchHaystack({ user, profile }) {
  return searchText(
    [user.fullName, profile.headline, profile.location?.city, ...profile.skills.map((skill) => skill.name), ...profile.workHistory.flatMap((entry) => [entry.title, entry.employer])].join(' '),
  )
}

/** M-056, OD4: the filters of Find candidates and the shortlist. */
function keep(query, country) {
  return ({ user, profile }) => {
    if (query.workPreference && profile.workPreference !== query.workPreference) return false
    if (query.availability && profile.availability !== query.availability) return false
    if (query.minYears != null && !(profile.yearsExperience >= query.minYears)) return false
    if (query.skill && !profile.skills.some((skill) => skill.key === skillKey(query.skill))) return false
    if (query.rightToWork && (country === 'REMOTE' || !hasRightToWorkIn(profile, country))) return false
    if (query.language && !profile.languages.some((language) => language.code === query.language && levelAtLeast(language.level, query.languageLevel ?? LEVELS[0])))
      return false
    if (query.placeId && profile.location?.placeId !== query.placeId) return false
    return !query.q || matchesKeywords(query.q, searchHaystack({ user, profile }))
  }
}

/** `scores` maps candidate ids to the match job's scores (P4-D10: without a job, the most recently updated first). */
function sortCards(cards, sort, language, scores = new Map()) {
  const score = (card) => scores.get(card.id)?.score ?? -1
  const sorters = {
    recommended: (a, b) => score(b) - score(a) || (b.overlap?.count ?? 0) - (a.overlap?.count ?? 0) || new Date(b.updatedAt) - new Date(a.updatedAt),
    experience: (a, b) => (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0),
    name: (a, b) => a.fullName.localeCompare(b.fullName, language),
  }
  return cards.sort(sorters[sort])
}

/** GET /recruiter/candidates: the picker country's population (M-054, M-055), filtered and sorted. */
export async function listCandidates(user, company, query) {
  const country = viewOf(user)
  const job = await matchJob(company, query.jobId)
  const entries = (await marketCandidates(country)).filter(keep(query, country))
  const card = await cardContext(user, company, entries, job)
  let items = entries.map(card)
  if (query.verified) items = items.filter((item) => item.verification.verified)
  items = sortCards(items, query.sort, user.language, job ? await resultsBy({ jobId: job._id }) : undefined)
  return { items, total: items.length, page: 1, pageSize: items.length, matchJob: job ? { id: String(job._id), title: job.title } : null }
}

/**
 * P4-D11: a profile opens when the candidate is listable in some country or has an application to this company
 * (any status: the recruiter saw it, so the link in the Applications table keeps working). `applicationFilter` narrows
 * the applications that count (a new conversation ignores withdrawn ones). An applicant entry has `viaApplication`.
 */
export async function accessibleCandidate(id, company, applicationFilter = {}) {
  const [entry] = await listableCandidates([id])
  if (entry) return entry
  if (await Application.exists({ candidateId: id, companyId: company._id, ...applicationFilter })) {
    const [user, profile] = await Promise.all([User.findOne({ _id: id, role: 'candidate', status: 'active' }), CandidateProfile.findOne({ userId: id, 'restricted.at': null })])
    if (user && profile) return { user, profile, viaApplication: true }
  }
  throw new AppError('NOT_FOUND')
}

const utcDay = (date) => date.toISOString().slice(0, 10)

/** GET /recruiter/candidates/:id: the full profile (M-026, privacy per M-187); records one view per day (M-184). */
export async function candidateProfile(user, company, id, jobId) {
  const entry = await accessibleCandidate(id, company)
  const { profile } = entry
  const now = new Date()
  await ProfileView.updateOne(
    { candidateId: entry.user._id, recruiterId: user._id, day: utcDay(now) },
    { $setOnInsert: { companyId: company._id, at: now } },
    { upsert: true },
  )
  const card = (await cardContext(user, company, [entry], await matchJob(company, jobId)))(entry)
  const applications = await Application.find({ companyId: company._id, candidateId: entry.user._id }).sort({ appliedAt: -1 })
  const jobTitles = new Map((await Job.find({ _id: { $in: applications.map((application) => application.jobId) } }, 'title')).map((job) => [String(job._id), job.title]))
  return {
    ...card,
    // M-071: one stage select per application; the profile of a non-applicant has none.
    applications: applications.map((application) => ({ id: String(application._id), status: application.status, stageId: String(application.stageId), appliedAt: application.appliedAt, job: { id: String(application.jobId), title: jobTitles.get(String(application.jobId)) } })),
    // A new conversation needs a listable candidate or an application that is not withdrawn (P7-C2, owner change).
    canStartConversation: !entry.viaApplication || applications.some((application) => application.status !== 'withdrawn'),
    // C24: course certificates show wherever the profile is visible (they do not verify skills, M-026).
    courseCertificates: (await badgesOf([entry.user._id]))(entry.user._id),
    about: profile.about,
    links: { linkedin: profile.links?.linkedin ?? '', portfolio: profile.links?.portfolio ?? '' },
    workHistory: latest(profile.workHistory, 'current').map(({ title, employer, start, end, current, description }) => ({ title, employer, start, end: end ?? null, current: Boolean(current), description: description ?? '' })),
    education: latest(profile.education, 'stillStudying').map(({ institution, degree, start, end, stillStudying }) => ({ institution, degree, start, end: end ?? null, stillStudying: Boolean(stillStudying) })),
    rightToWorkInView: viewOf(user) === 'REMOTE' ? null : hasRightToWorkIn(profile, viewOf(user)),
  }
}

/* ---------- shortlist, notes, activity ---------- */

/** M-079, M-137: the company shortlist in the picker country; candidates no longer listable are only counted. */
export async function shortlist(user, company, query) {
  const entries = await ShortlistEntry.find({ companyId: company._id }).sort({ createdAt: -1 })
  const listable = await listableCandidates(entries.map((entry) => entry.candidateId))
  const country = viewOf(user)
  const shown = listable.filter(({ profile }) => inMarket(profile, country)).filter(keep(query, country))
  const job = await matchJob(company, query.jobId)
  const card = await cardContext(user, company, shown, job)
  const adders = new Map((await User.find({ _id: { $in: entries.map((entry) => entry.addedBy) } }, 'fullName')).map((adder) => [String(adder._id), adder.fullName]))
  const byCandidate = new Map(entries.map((entry) => [String(entry.candidateId), entry]))
  let items = shown.map((item) => {
    const entry = byCandidate.get(String(item.user._id))
    return { ...card(item), addedAt: entry.createdAt, addedBy: adders.get(String(entry.addedBy)) ?? null }
  })
  if (query.verified) items = items.filter((item) => item.verification.verified)
  items = sortCards(items, query.sort, user.language, job ? await resultsBy({ jobId: job._id }) : undefined)
  return { items, total: items.length, page: 1, pageSize: items.length, hiddenCount: entries.length - listable.length }
}

export async function addToShortlist(user, company, candidateId) {
  await accessibleCandidate(candidateId, company)
  const result = await ShortlistEntry.updateOne(
    { companyId: company._id, candidateId },
    { $setOnInsert: { companyId: company._id, candidateId, addedBy: user._id } },
    { upsert: true },
  )
  if (result.upsertedCount) await recordActivity({ companyId: company._id, candidateId, actorId: user._id, type: 'shortlisted' })
}

export async function removeFromShortlist(user, company, candidateId) {
  const { deletedCount } = await ShortlistEntry.deleteOne({ companyId: company._id, candidateId })
  if (deletedCount) await recordActivity({ companyId: company._id, candidateId, actorId: user._id, type: 'unshortlisted' })
}

const nameOf = async (userId) => (userId ? (await User.findById(userId, 'fullName'))?.fullName ?? null : null)

export async function getNote(company, candidateId) {
  await accessibleCandidate(candidateId, company)
  const note = await CandidateNote.findOne({ companyId: company._id, candidateId })
  return { text: note?.text ?? '', updatedAt: note?.updatedAt ?? null, updatedBy: await nameOf(note?.updatedBy) }
}

/** M-080: one note per company and candidate, at most 5,000 characters. */
export async function saveNote(user, company, candidateId, text) {
  await accessibleCandidate(candidateId, company)
  await CandidateNote.updateOne({ companyId: company._id, candidateId }, { text, updatedBy: user._id }, { upsert: true })
  await recordActivity({ companyId: company._id, candidateId, actorId: user._id, type: 'note_updated' })
  return getNote(company, candidateId)
}

/** M-081: the company-wide timeline, newest first; an event without an actor is the candidate's own. */
export async function activity(company, candidateId) {
  await accessibleCandidate(candidateId, company)
  const events = await RecruiterActivity.find({ companyId: company._id, candidateId }).sort({ at: -1 })
  const actors = new Map((await User.find({ _id: { $in: events.map((event) => event.actorId).filter(Boolean) } }, 'fullName')).map((actor) => [String(actor._id), actor.fullName]))
  const items = events.map((event) => ({
    id: String(event._id),
    type: event.type,
    params: event.params ?? {},
    at: event.at,
    actor: event.actorId ? { id: String(event.actorId), name: actors.get(String(event.actorId)) ?? null } : null,
  }))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/* ---------- CV access and requests (M-029, M-187, U19, P4-D12) ---------- */

const versionDto = (version, file, viewerId) => ({
  id: String(version._id),
  number: version.number,
  originalName: version.originalName,
  mime: version.mime,
  size: version.size,
  createdAt: version.createdAt,
  url: signedUrl(file, viewerId),
  downloadUrl: signedUrl(file, viewerId, { download: true }),
})

/** The live CV only with `resumeVisible`; versions shared through approved requests; the CVs sent with applications. */
export async function candidateCv(user, company, candidateId) {
  const { user: candidate, profile } = await accessibleCandidate(candidateId, company)
  const requests = await CvAccessRequest.find({ companyId: company._id, candidateId }).sort({ createdAt: -1 })
  const sharedIds = requests.filter((request) => request.status === 'approved').map((request) => request.cvVersionId)
  const versionIds = [...sharedIds, ...(candidate.privacy.resumeVisible && profile.liveCvVersionId ? [profile.liveCvVersionId] : [])]
  const versions = await CvVersion.find({ _id: { $in: versionIds }, fileId: { $ne: null } })
  const files = new Map((await File.find({ _id: { $in: versions.map((version) => version.fileId) } })).map((file) => [String(file._id), file]))
  const dto = (id) => {
    const version = versions.find((item) => String(item._id) === String(id))
    const file = version && files.get(String(version.fileId))
    return file ? versionDto(version, file, user._id) : null
  }
  // M-073, M-030: the CV an applicant sent with each application to this company, or "removed" once deleted.
  const applications = await Application.find({ companyId: company._id, candidateId }).sort({ appliedAt: -1 })
  const attached = await CvVersion.find({ _id: { $in: applications.map((application) => application.cvVersionId) }, fileId: { $ne: null } })
  const attachedFiles = new Map((await File.find({ _id: { $in: attached.map((version) => version.fileId) } })).map((file) => [String(file._id), file]))
  const jobTitles = new Map((await Job.find({ _id: { $in: applications.map((application) => application.jobId) } }, 'title')).map((job) => [String(job._id), job.title]))
  const applied = applications.map((application) => {
    const version = attached.find((item) => String(item._id) === String(application.cvVersionId))
    const file = version && attachedFiles.get(String(version.fileId))
    return { applicationId: String(application._id), jobTitle: jobTitles.get(String(application.jobId)), appliedAt: application.appliedAt, cv: file ? versionDto(version, file, user._id) : null }
  })
  return {
    applied,
    live: candidate.privacy.resumeVisible && profile.liveCvVersionId ? dto(profile.liveCvVersionId) : null,
    resumeVisible: candidate.privacy.resumeVisible,
    shared: [...new Set(sharedIds.map(String))].map(dto).filter(Boolean),
    requests: requests.map((request) => ({ id: String(request._id), reason: request.reason, details: request.details ?? '', status: request.status, createdAt: request.createdAt, decidedAt: request.decidedAt ?? null })),
  }
}

/** M-029, U19: one pending request per company (P4-D12); the candidate is emailed (non-critical, OQ-6c). */
export async function requestCv(user, company, candidateId, { reason, details }) {
  const { user: candidate } = await accessibleCandidate(candidateId, company)
  if (await CvAccessRequest.exists({ companyId: company._id, candidateId, status: 'pending' })) throw new AppError('CONFLICT', { params: { reason: 'pending' } })
  await CvAccessRequest.create({ companyId: company._id, candidateId, requestedBy: user._id, reason, details: details || undefined })
  await recordActivity({ companyId: company._id, candidateId, actorId: user._id, type: 'cv_request', params: { reason } })
  await sendEmail({
    type: 'cv_request',
    to: candidate.email,
    userId: candidate._id,
    language: candidate.language,
    params: {
      name: candidate.fullName,
      company: company.displayName,
      reason: t(candidate.language, `cvRequestReason.${reason}`),
      details,
      link: `${config.clientOrigin}/candidate/cv-versions`,
    },
  })
}

/* ---------- relevance and the recruiter Overview (M-051, A: recruiter A9, RQ-34) ---------- */

/** GET /recruiter/jobs/:id/relevant-talent: the job's best relevant candidates. */
export async function relevantTalent(user, company, jobId) {
  const job = await Job.findOne({ _id: jobId, companyId: company._id })
  if (!job) throw new AppError('NOT_FOUND')
  const relevant = (await relevantCandidates(job)).slice(0, RELEVANT_TALENT).map(({ entry }) => entry)
  const card = await cardContext(user, company, relevant, job)
  return { items: relevant.map(card), total: job.relevantCount }
}

const rank = (a, b) => (b.result?.score ?? -1) - (a.result?.score ?? -1) || b.overlap.matched.length - a.overlap.matched.length

/** Every candidate relevant to at least one published job, with the job where they rank best. */
async function relevantAcrossJobs(company) {
  const best = new Map()
  for (const job of await Job.find({ companyId: company._id, status: 'published' })) {
    for (const item of await relevantCandidates(job)) {
      const id = String(item.entry.user._id)
      if (!best.has(id) || rank(item, best.get(id)) < 0) best.set(id, { ...item, job })
    }
  }
  return [...best.values()]
}

/** §3.15 Recruiter Overview KPIs; Applications = active applications to the company's jobs (M-082). */
export async function recruiterOverview(company) {
  const [openPositions, relevant, shortlisted, applications] = await Promise.all([
    Job.countDocuments({ companyId: company._id, status: 'published' }),
    relevantAcrossJobs(company),
    ShortlistEntry.countDocuments({ companyId: company._id }),
    Application.countDocuments({ companyId: company._id, ...ACTIVE_FILTER }),
  ])
  return { openPositions, recommendedCandidates: relevant.length, shortlisted, applications }
}

/** "Talent worth meeting": the top 3 relevant candidates neither shortlisted nor applied to the company (§3.8, A9). */
export async function talentCards(user, company) {
  const [shortlisted, applied] = await Promise.all([
    ShortlistEntry.distinct('candidateId', { companyId: company._id }),
    Application.distinct('candidateId', { companyId: company._id }),
  ])
  const known = new Set([...shortlisted, ...applied].map(String))
  const top = (await relevantAcrossJobs(company))
    .filter(({ entry }) => !known.has(String(entry.user._id)))
    .sort(rank)
    .slice(0, TALENT_CARDS)
  const items = []
  for (const { entry, job } of top) {
    const card = await cardContext(user, company, [entry], job)
    items.push({ ...card(entry), bestJob: { id: String(job._id), title: job.title } })
  }
  return { items, total: items.length, page: 1, pageSize: items.length }
}
