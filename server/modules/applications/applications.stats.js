import { DateTime } from 'luxon'
import { ShortlistEntry } from '../discovery/discovery.model.js'
import { ACTIVE_FILTER, Application, PipelineStage } from './applications.model.js'

/*
 * Application numbers: counters (M-094), the recruiter Overview KPI (M-082), the funnel over the company's own
 * stages ever reached (M-178) and the hiring momentum with Monday weeks in the browser time zone (M-083, M-170).
 */

/** GET /me/counters for a candidate: the active applications. */
export async function candidateCounters(user) {
  return { activeApplications: await Application.countDocuments({ candidateId: user._id, ...ACTIVE_FILTER }) }
}

/** M-082: applications to the company's jobs, excluding not selected and withdrawn. */
export function activeApplicationCount(company) {
  return Application.countDocuments({ companyId: company._id, ...ACTIVE_FILTER })
}

/** M-178: per stage, the applications that ever sat in it; withdrawn ones are left out, rejected ones counted. */
export async function funnel(company) {
  const stages = await PipelineStage.find({ companyId: company._id }).sort({ order: 1 })
  const items = []
  for (const stage of stages) {
    const count = await Application.countDocuments({ companyId: company._id, status: { $ne: 'withdrawn' }, 'history.stageId': stage._id })
    items.push({ id: String(stage._id), name: stage.name, category: stage.category, count })
  }
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/**
 * The Funnel view of the Hiring pipeline (owner decision 2026-11-05): per company stage in board order, `now` = the
 * active applications in it (as the board) and `reached` = those that ever sat in it, withdrawn ones left out (M-178).
 * For all jobs or one; `applicants` and `hired` head the view.
 */
export async function pipelineFunnel(company, { jobId } = {}) {
  const [stages, applications] = await Promise.all([
    PipelineStage.find({ companyId: company._id }).sort({ order: 1 }),
    Application.find({ companyId: company._id, status: { $ne: 'withdrawn' }, ...(jobId && { jobId }) }, 'stageId status history.stageId'),
  ])
  const items = stages.map((stage) => {
    const id = String(stage._id)
    return {
      id,
      name: stage.name,
      category: stage.category,
      tone: stage.tone,
      now: applications.filter((application) => application.status !== 'not_selected' && String(application.stageId) === id).length,
      reached: applications.filter((application) => application.history.some((entry) => String(entry.stageId) === id)).length,
    }
  })
  return { items, applicants: applications.length, hired: applications.filter((application) => application.status === 'hired').length }
}

/**
 * Applications received and shortlist additions per day of this or last week (Monday to Sunday) in `timeZone`.
 * Applications count by the day they were sent, whatever became of them since.
 */
export async function momentum(company, { timeZone, period }, now = DateTime.now()) {
  const thisWeek = now.setZone(timeZone).startOf('week')
  const from = period === 'last_week' ? thisWeek.minus({ weeks: 1 }) : thisWeek
  const range = { $gte: from.toJSDate(), $lt: from.plus({ weeks: 1 }).toJSDate() }
  const [applications, shortlisted] = await Promise.all([
    Application.find({ companyId: company._id, appliedAt: range }, 'appliedAt'),
    ShortlistEntry.find({ companyId: company._id, createdAt: range }, 'createdAt'),
  ])
  const days = Array.from({ length: 7 }, (_, offset) => ({ date: from.plus({ days: offset }).toISODate(), applications: 0, shortlisted: 0 }))
  const bucket = (date, series) => {
    const day = days.find((entry) => entry.date === DateTime.fromJSDate(date, { zone: timeZone }).toISODate())
    if (day) day[series] += 1
  }
  applications.forEach((application) => bucket(application.appliedAt, 'applications'))
  shortlisted.forEach((entry) => bucket(entry.createdAt, 'shortlisted'))
  return { period, timeZone, days }
}
