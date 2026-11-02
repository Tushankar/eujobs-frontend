import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { ScheduledTask } from '../../jobs/models.js'
import { scheduleTask, taskHandlers } from '../../jobs/scheduler.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { Company } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { User } from '../users/users.model.js'
import { Application } from './applications.model.js'

/*
 * Application emails (§3.4, §3.17). Status emails wait 10 minutes after the last move and go out only when the
 * mapped status differs from the last status the candidate was told (M-091, U13, U33, OQ-6e). The recruiter gets
 * one "new applications" email per job per hour (OD14): an hour after the first application nobody has been told
 * about, and at least an hour after the previous email.
 */
const { statusDelayMs, newApplicationsWindowMs } = LIMITS.applicationEmail
const stageKey = (applicationId) => `email.stage:${applicationId}`
const newApplicationsKey = (jobId) => `email.new-applications:${jobId}`

/** A move or a rejection restarts the 10-minute wait: the pending task for this application collapses (U13). */
export function scheduleStageEmail(application) {
  return scheduleTask({
    type: 'email.stage',
    key: stageKey(application._id),
    dueAt: new Date(Date.now() + statusDelayMs),
    payload: { applicationId: String(application._id) },
  })
}

export function cancelStageEmail(application) {
  return ScheduledTask.deleteOne({ key: stageKey(application._id), status: 'pending' })
}

/** OD14: the first unsent application opens the window; later ones join the pending email. */
export async function scheduleNewApplicationsEmail(job, appliedAt) {
  const key = newApplicationsKey(job._id)
  if (await ScheduledTask.exists({ key, status: 'pending' })) return
  const dueAt = new Date(Math.max(appliedAt.getTime(), job.applicantsEmailedAt?.getTime() ?? 0) + newApplicationsWindowMs)
  await scheduleTask({ type: 'email.new-applications', key, dueAt, payload: { jobId: String(job._id) } })
}

async function sendStatusEmail({ applicationId }) {
  const application = await Application.findById(applicationId)
  if (!application || application.status === 'withdrawn' || application.status === application.lastEmailedStatus) return
  const rejected = application.status === 'not_selected'
  // A rejection sent without the box checked tells the candidate nothing, so they are still "told" the old status.
  if (rejected && !application.rejectNotify) return
  const [candidate, job] = await Promise.all([User.findById(application.candidateId), Job.findById(application.jobId, 'title companyId')])
  const company = await Company.findById(application.companyId, 'displayName')
  await sendEmail({
    type: rejected ? 'application_rejected' : 'application_status',
    to: candidate.email,
    userId: candidate._id,
    language: candidate.language,
    params: {
      name: candidate.fullName,
      job: job.title,
      company: company.displayName,
      status: t(candidate.language, `labels.applicationStatus.${application.status}`),
      nextStep: t(candidate.language, `labels.nextStep.${application.status}`),
      link: `${config.clientOrigin}/candidate/${rejected ? 'jobs' : 'applications'}`,
    },
  })
  await Application.updateOne({ _id: application._id }, { lastEmailedStatus: application.status }, { timestamps: false })
}

async function sendNewApplicationsEmail({ jobId }, task, now) {
  const [job, unsent] = await Promise.all([Job.findById(jobId, 'title companyId'), Application.find({ jobId, recruiterNotified: false }, 'status')])
  const ids = unsent.map((application) => application._id)
  const count = unsent.filter((application) => application.status !== 'withdrawn').length
  const recruiter = await User.findOne({ companyId: job.companyId, role: 'recruiter', status: 'active' })
  if (count > 0 && recruiter) {
    const countLabel = interpolate(t(recruiter.language, `labels.newApplications.${count === 1 ? 'one' : 'other'}`), { count })
    await sendEmail({
      type: 'new_applications',
      to: recruiter.email,
      userId: recruiter._id,
      language: recruiter.language,
      params: { name: recruiter.fullName, job: job.title, countLabel, link: `${config.clientOrigin}/recruiter/applications` },
    })
  }
  await Application.updateMany({ _id: { $in: ids } }, { recruiterNotified: true }, { timestamps: false })
  if (count > 0) await Job.updateOne({ _id: job._id }, { applicantsEmailedAt: now }, { timestamps: false })
}

taskHandlers['email.stage'] = sendStatusEmail
taskHandlers['email.new-applications'] = sendNewApplicationsEmail
