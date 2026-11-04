import { t } from '../../lib/i18n.js'
import { paginate } from '../../lib/pages.js'
import { Application } from '../applications/applications.model.js'
import { Company } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { User } from '../users/users.model.js'

/*
 * Admin › Applications (M-206, P10-Q14): every application, newest first, with the candidate-facing status; filtered
 * by status, the job's country (M-138) and a search in candidate, job and company; server-paginated; audited export.
 */
export async function filteredApplications({ q, status, country }) {
  const jobFilter = country ? { country } : {}
  const jobs = await Job.find(jobFilter, 'title country companyId')
  const jobOf = new Map(jobs.map((job) => [String(job._id), job]))
  const applications = await Application.find({ ...(status && { status }), ...(country && { jobId: { $in: jobs.map((job) => job._id) } }) }).sort({ appliedAt: -1, _id: -1 })
  const [users, companies] = await Promise.all([
    User.find({ _id: { $in: applications.map((application) => application.candidateId) } }, 'fullName'),
    Company.find({ _id: { $in: applications.map((application) => application.companyId) } }, 'displayName'),
  ])
  const nameOf = new Map(users.map((user) => [String(user._id), user.fullName]))
  const companyOf = new Map(companies.map((company) => [String(company._id), company.displayName]))
  const rows = applications.map((application) => {
    const job = jobOf.get(String(application.jobId))
    return {
      id: String(application._id),
      candidate: { id: String(application.candidateId), name: nameOf.get(String(application.candidateId)) ?? null },
      job: { id: String(application.jobId), title: job?.title ?? null, country: job?.country ?? null },
      company: companyOf.get(String(application.companyId)) ?? null,
      appliedAt: application.appliedAt,
      status: application.status,
    }
  })
  const needle = q?.toLowerCase()
  return needle ? rows.filter((row) => [row.candidate.name, row.job.title, row.company].some((text) => text?.toLowerCase().includes(needle))) : rows
}

export async function listApplications(query) {
  return paginate(await filteredApplications(query), query)
}

/** OQ-6d: headers and the status label in the admin's language. */
export function exportRows(rows, language) {
  return [
    t(language, 'csv.applications'),
    ...rows.map((row) => [row.candidate.name ?? '', row.job.title ?? '', row.company ?? '', row.job.country ?? '', row.appliedAt.toISOString(), t(language, `labels.applicationStatus.${row.status}`)]),
  ]
}
