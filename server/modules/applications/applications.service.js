import mongoose from 'mongoose'
import { AppError, fieldError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { skillOverlap } from '../../lib/skills.js'
import { candidateSummary, loadProfile } from '../candidates/candidates.service.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { Company } from '../companies/companies.model.js'
import { CvVersion } from '../cv/cv.model.js'
import { noteCounts, recordActivity } from '../discovery/discovery.service.js'
import { File } from '../files/files.model.js'
import { interviewsByApplication } from '../interviews/interviews.cards.js'
import { Job } from '../jobs/jobs.model.js'
import { isVisible, visibleFilter } from '../jobs/jobs.search.js'
import { notifyCompany } from '../notifications/notifications.service.js'
import { User } from '../users/users.model.js'
import { cancelStageEmail, scheduleNewApplicationsEmail, scheduleStageEmail } from './applications.emails.js'
import { ACTIVE_FILTER, Application, PipelineStage } from './applications.model.js'

/*
 * Applications (§3.4): the apply gate in one request (M-043, M-073, M-074), withdraw, the candidate's list with
 * dated history (M-075), the recruiter's table and board data (M-076, M-077), stage moves and rejection (M-070 …
 * M-072, M-090, OD5, U33). Stage management is in applications.pipeline.js, the Overview numbers in applications.stats.js.
 */

/** OD5: the candidate-visible status of a stage category. */
export const STATUS_OF_CATEGORY = {
  applied: 'applied',
  screening: 'under_review',
  shortlisted: 'under_review',
  interview: 'interview',
  offer: 'offer',
  hired: 'hired',
}

const historyEntry = (status, stage, actor, at = new Date()) => ({
  status,
  stageId: stage._id,
  stageName: stage.name,
  category: stage.category,
  at,
  actorId: actor._id,
  actorType: actor.role,
})

/** The stage the application sits in; a removed one (after a withdrawal or rejection) lives on in the history (M-072). */
async function currentStage(application) {
  const last = application.history.at(-1)
  return (await PipelineStage.findById(application.stageId)) ?? { _id: last.stageId, name: last.stageName, category: last.category }
}

const place = (location) => (location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null)

/* ---------- candidate ---------- */

/** What the candidate sees: dated status steps (a move inside one status is not a step), the job and the CV used. */
async function candidateDtos(user, applications) {
  const jobs = await Job.find({ _id: { $in: applications.map((application) => application.jobId) } })
  const companies = await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } })
  const logos = await logoUrls(companies, user._id)
  const visible = new Set((await Job.find({ _id: { $in: jobs.map((job) => job._id) }, ...(await visibleFilter()) }, '_id')).map((job) => String(job._id)))
  const versions = new Map((await CvVersion.find({ _id: { $in: applications.map((application) => application.cvVersionId) } }, 'number originalName fileId')).map((version) => [String(version._id), version]))
  const jobById = new Map(jobs.map((job) => [String(job._id), job]))
  const companyById = new Map(companies.map((company) => [String(company._id), company]))
  const interviews = await interviewsByApplication(user, applications.map((application) => application._id))

  return applications.map((application) => {
    const job = jobById.get(String(application.jobId))
    const company = companyById.get(String(job.companyId))
    const version = versions.get(String(application.cvVersionId))
    const steps = application.history.filter((entry, index, all) => index === 0 || entry.status !== all[index - 1].status).map(({ status, at }) => ({ status, at }))
    return {
      id: String(application._id),
      status: application.status,
      appliedAt: application.appliedAt,
      withdrawnAt: application.withdrawnAt ?? null,
      coverNote: application.coverNote ?? '',
      history: steps,
      // §3.23: the application's interviews, for its activity.
      interviews: interviews.get(String(application._id)) ?? [],
      cv: version ? { number: version.number, originalName: version.originalName, removed: !version.fileId } : null,
      job: {
        id: String(job._id),
        title: job.title,
        workPreference: job.workPreference ?? null,
        country: job.country ?? null,
        location: place(job.location),
        accepting: visible.has(String(job._id)),
        company: { id: String(company._id), displayName: company.displayName, logoUrl: logos.get(String(company._id)) ?? null },
      },
    }
  })
}

export async function listCandidateApplications(user) {
  const items = await candidateDtos(user, await Application.find({ candidateId: user._id }).sort({ appliedAt: -1 }))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

export async function getCandidateApplication(user, id) {
  const application = await Application.findOne({ _id: id, candidateId: user._id })
  if (!application) throw new AppError('NOT_FOUND')
  return (await candidateDtos(user, [application]))[0]
}

/** M-073: a CV version of the candidate that still has its file; the live one by default. */
async function applicationCv(user, profile, cvVersionId) {
  const id = cvVersionId ?? profile.liveCvVersionId
  const version = id && (await CvVersion.findOne({ _id: id, userId: user._id, fileId: { $ne: null } }, '_id'))
  if (!version) throw fieldError({ cvVersionId: 'invalid' })
  return version._id
}

/**
 * The apply gate (§3.4): the `apply` entitlement is checked by the route (PLAN_REQUIRED), then the completeness
 * checklist (PROFILE_INCOMPLETE with the missing items) and the job (JOB_NOT_ACCEPTING), all in this one request.
 */
export async function apply(user, { jobId, cvVersionId, coverNote, consent }) {
  const { completeness } = await candidateSummary(user)
  if (!completeness.complete) {
    throw new AppError('PROFILE_INCOMPLETE', { params: { missing: completeness.items.filter((item) => !item.done).map((item) => item.key) } })
  }
  const job = await Job.findById(jobId)
  if (!job || job.status === 'draft') throw new AppError('NOT_FOUND')
  if (!(await isVisible(job))) throw new AppError('JOB_NOT_ACCEPTING')

  if (!consent) throw fieldError({ consent: 'required' })
  const cvId = await applicationCv(user, await loadProfile(user._id), cvVersionId)
  if (await Application.exists({ candidateId: user._id, jobId, status: { $ne: 'withdrawn' } })) throw new AppError('CONFLICT', { params: { reason: 'applied' } })

  const stage = await PipelineStage.findOne({ companyId: job.companyId, isEntry: true })
  const now = new Date()
  let application
  try {
    application = await Application.create({
      candidateId: user._id,
      jobId: job._id,
      companyId: job.companyId,
      stageId: stage._id,
      cvVersionId: cvId,
      coverNote: coverNote || undefined,
      consentAt: now,
      appliedAt: now,
      history: [historyEntry('applied', stage, user, now)],
    })
  } catch (error) {
    // Two requests at once: the partial unique index (§4.3) lets only one through.
    if (error.code === 11000) throw new AppError('CONFLICT', { params: { reason: 'applied' } })
    throw error
  }
  await recordActivity({ companyId: job.companyId, candidateId: user._id, type: 'applied', params: { jobId: String(job._id), jobTitle: job.title } })
  await scheduleNewApplicationsEmail(job, now)
  await notifyCompany(job.companyId, 'application_new', { params: { candidate: user.fullName, job: job.title }, target: { kind: 'application', id: application._id } })
  return (await candidateDtos(user, [application]))[0]
}

/** M-074, M-076: the record stays, as withdrawn; a pending status email is dropped. */
export async function withdraw(user, id) {
  const application = await Application.findOne({ _id: id, candidateId: user._id })
  if (!application) throw new AppError('NOT_FOUND')
  if (application.status === 'withdrawn') throw new AppError('CONFLICT', { params: { status: application.status } })
  const now = new Date()
  application.status = 'withdrawn'
  application.withdrawnAt = now
  application.history.push(historyEntry('withdrawn', await currentStage(application), user, now))
  await application.save()
  await cancelStageEmail(application)
  const job = await Job.findById(application.jobId, 'title')
  await recordActivity({ companyId: application.companyId, candidateId: user._id, type: 'withdrawn', params: { jobId: String(job._id), jobTitle: job.title } })
  await notifyCompany(application.companyId, 'application_withdrawn', { params: { candidate: user.fullName, job: job.title }, target: { kind: 'application', id: application._id } })
  return (await candidateDtos(user, [application]))[0]
}

/* ---------- recruiter ---------- */

const stageOf = (application, stages) => {
  const stage = stages.get(String(application.stageId))
  if (stage) return { id: String(stage._id), name: stage.name, category: stage.category, tone: stage.tone }
  // The stage was removed after the application left it (withdrawn or not selected): history keeps the name (M-072).
  const last = application.history.at(-1)
  return { id: null, name: last.stageName, category: last.category, tone: 'neutral' }
}

/**
 * Table and board rows: the candidate as a card, the job, the stage (M-069, M-077), the company's note count on the
 * candidate and every dated stage step, for the Hiring pipeline's candidate panel.
 */
async function recruiterDtos(viewer, applications) {
  const candidateIds = applications.map((application) => application.candidateId)
  const [users, profiles, jobs, stages, notes] = await Promise.all([
    User.find({ _id: { $in: candidateIds } }, 'fullName'),
    CandidateProfile.find({ userId: { $in: candidateIds } }),
    Job.find({ _id: { $in: applications.map((application) => application.jobId) } }),
    PipelineStage.find({ _id: { $in: applications.map((application) => application.stageId) } }),
    applications.length ? noteCounts(applications[0].companyId, candidateIds) : new Map(),
  ])
  const photos = new Map((await File.find({ _id: { $in: profiles.map((profile) => profile.photo?.fileId).filter(Boolean) } })).map((file) => [String(file._id), file]))
  const userById = new Map(users.map((user) => [String(user._id), user]))
  const profileById = new Map(profiles.map((profile) => [String(profile.userId), profile]))
  const jobById = new Map(jobs.map((job) => [String(job._id), job]))
  const stageById = new Map(stages.map((stage) => [String(stage._id), stage]))

  return applications.map((application) => {
    const candidate = userById.get(String(application.candidateId))
    const profile = profileById.get(String(application.candidateId))
    const job = jobById.get(String(application.jobId))
    const photo = profile?.photo?.fileId && photos.get(String(profile.photo.fileId))
    return {
      id: String(application._id),
      status: application.status,
      appliedAt: application.appliedAt,
      stage: stageOf(application, stageById),
      history: application.history.map(({ status, stageName, at }) => ({ status, stageName, at })),
      noteCount: notes.get(String(application.candidateId)) ?? 0,
      job: { id: String(job._id), title: job.title },
      candidate: {
        id: String(candidate._id),
        fullName: candidate.fullName,
        photoUrl: photo ? signedUrl(photo, viewer._id) : null,
        headline: profile?.headline ?? '',
        yearsExperience: profile?.yearsExperience ?? null,
        workPreference: profile?.workPreference ?? null,
        alignedSkills: profile ? skillOverlap(profile.skills, job).matched.length : 0,
      },
    }
  })
}

/**
 * GET /recruiter/applications. Without a status filter the active applications (board and KPI definition, M-082);
 * `status` lists the withdrawn or not selected ones (M-076, M-090). `counts` follow the job filter only.
 */
export async function listCompanyApplications(viewer, company, { jobId, stageId, status }) {
  const scope = { companyId: company._id, ...(jobId && { jobId }) }
  const filter = status ? { ...scope, status } : { ...scope, ...ACTIVE_FILTER, ...(stageId && { stageId }) }
  const [applications, counts] = await Promise.all([
    Application.find(filter).sort({ appliedAt: -1 }),
    // Aggregation does not cast ids as queries do.
    Application.aggregate([{ $match: { ...scope, ...(jobId && { jobId: new mongoose.Types.ObjectId(jobId) }) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ])
  const countOf = (statuses) => counts.filter((entry) => statuses.includes(entry._id)).reduce((sum, entry) => sum + entry.count, 0)
  const items = await recruiterDtos(viewer, applications)
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length,
    counts: { active: countOf(['applied', 'under_review', 'interview', 'offer', 'hired']), not_selected: countOf(['not_selected']), withdrawn: countOf(['withdrawn']) },
  }
}

/** GET /recruiter/applications/:id: one row of this company, whatever its status (P11b-Q9). */
export async function companyApplication(viewer, company, id) {
  const application = await Application.findOne({ _id: id, companyId: company._id })
  if (!application) throw new AppError('NOT_FOUND')
  return (await recruiterDtos(viewer, [application]))[0]
}

async function ownApplication(company, id) {
  const application = await Application.findOne({ _id: id, companyId: company._id })
  if (!application) throw new AppError('NOT_FOUND')
  if (application.status === 'withdrawn') throw new AppError('CONFLICT', { params: { status: application.status } })
  return application
}

async function recordMove(user, application, type, params) {
  const job = await Job.findById(application.jobId, 'title')
  await recordActivity({ companyId: application.companyId, candidateId: application.candidateId, actorId: user._id, type, params: { jobId: String(job._id), jobTitle: job.title, ...params } })
}

/**
 * M-071, M-072, U33, OQ-6e: moves one application to a stage of this company; the status follows the stage
 * category (OD5). Choosing a stage again for a not selected application undoes the rejection.
 */
export async function moveToStage(user, company, id, stageId) {
  const application = await ownApplication(company, id)
  const stage = await PipelineStage.findOne({ _id: stageId, companyId: company._id })
  if (!stage) throw fieldError({ stageId: 'invalid' })
  if (String(application.stageId) === String(stage._id) && application.status !== 'not_selected') return (await recruiterDtos(user, [application]))[0]

  const status = STATUS_OF_CATEGORY[stage.category]
  application.stageId = stage._id
  application.status = status
  application.notSelectedAt = undefined
  application.rejectNotify = false
  application.history.push(historyEntry(status, stage, user))
  await application.save()
  await scheduleStageEmail(application)
  await recordMove(user, application, 'stage_changed', { stage: stage.name })
  return (await recruiterDtos(user, [application]))[0]
}

/** M-090, U33: not selected; the card leaves the board; the email (if chosen) waits the 10-minute undo window. */
export async function reject(user, company, id, { notify }) {
  const application = await ownApplication(company, id)
  if (application.status === 'not_selected') throw new AppError('CONFLICT', { params: { status: application.status } })
  const stage = await currentStage(application)
  const now = new Date()
  application.status = 'not_selected'
  application.notSelectedAt = now
  application.rejectNotify = notify
  application.history.push(historyEntry('not_selected', stage, user, now))
  await application.save()
  await scheduleStageEmail(application)
  await recordMove(user, application, 'rejected', { stage: stage.name })
  return (await recruiterDtos(user, [application]))[0]
}
