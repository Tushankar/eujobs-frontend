import { sideOf } from '../config/enums.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { STATUS_OF_CATEGORY } from '../modules/applications/applications.service.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { User } from '../modules/users/users.model.js'
import { PLACEMENTS } from './data/applications.js'
import { CANDIDATES } from './data/candidates.js'

/*
 * Applications of seed:demo with coherent stage histories and company timelines. The emails for them were sent
 * long ago, so `lastEmailedStatus` is the current status and no task is scheduled.
 */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * One application to `job`, moved by `recruiter` (or agency) through `path` (stage categories, one a day after
 * `appliedAt`), with the company timeline. `stages` maps a category to the company's stage.
 */
export async function seedApplication({ candidate, job, recruiter, stages, appliedAt, path }) {
  const profile = await CandidateProfile.findOne({ userId: candidate._id }, 'liveCvVersionId')
  const jobParams = { jobId: String(job._id), jobTitle: job.title }
  const entry = (status, stage, at, actor) => ({ status, stageId: stage._id, stageName: stage.name, category: stage.category, at, actorId: actor._id, actorType: sideOf(actor.role) })

  const history = [entry('applied', stages.get('applied'), appliedAt, candidate)]
  const activities = [{ companyId: job.companyId, candidateId: candidate._id, type: 'applied', params: jobParams, at: appliedAt }]
  for (const [step, category] of path.entries()) {
    const at = new Date(appliedAt.getTime() + (step + 1) * DAY_MS)
    history.push(entry(STATUS_OF_CATEGORY[category], stages.get(category), at, recruiter))
    activities.push({ companyId: job.companyId, candidateId: candidate._id, actorId: recruiter._id, type: 'stage_changed', params: { ...jobParams, stage: stages.get(category).name }, at })
  }
  const last = history.at(-1)
  const application = await Application.create({
    candidateId: candidate._id,
    jobId: job._id,
    companyId: job.companyId,
    status: last.status,
    stageId: last.stageId,
    cvVersionId: profile.liveCvVersionId,
    consentAt: appliedAt,
    appliedAt,
    history,
    lastEmailedStatus: last.status,
    recruiterNotified: true,
  })
  await RecruiterActivity.insertMany(activities)
  return application
}

export async function seedApplications({ emailOf, now }) {
  const sarah = await User.findOne({ email: emailOf({ tag: 'sarah' }) })
  const company = await Company.findOne({ ownerUserId: sarah._id })
  const stages = new Map((await PipelineStage.find({ companyId: company._id })).map((stage) => [stage.category, stage]))
  const jobs = new Map((await Job.find({ companyId: company._id })).map((job) => [job.title, job]))

  for (const { person, job: title, daysAgo, path } of PLACEMENTS) {
    const candidate = await User.findOne({ email: emailOf(CANDIDATES.find((item) => item.fullName === person)) })
    await seedApplication({ candidate, job: jobs.get(title), recruiter: sarah, stages, appliedAt: new Date(now - daysAgo * DAY_MS), path })
  }
}
