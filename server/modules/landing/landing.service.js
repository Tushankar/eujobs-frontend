import { ENUMS } from '../../config/enums.js'
import { signedUrl } from '../../lib/files.js'
import { Company } from '../companies/companies.model.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { visibleFilter } from '../jobs/jobs.search.js'
import { listFaqs } from '../meta/meta.service.js'

/*
 * The public landing page (no session): the newest visible jobs, live counts per work mode and employment type, and
 * the candidate FAQs. Only what a job card already shows candidates is exposed. Logo links are signed for the logo's
 * owner, since there is no viewer; logo files are not access-logged (files.routes.js).
 */
const LATEST_JOBS = 8

async function logoUrls(companies) {
  const files = await File.find({ _id: { $in: companies.map((company) => company.logoFileId).filter(Boolean) } })
  const byId = new Map(files.map((file) => [String(file._id), file]))
  return new Map(companies.map((company) => {
    const file = company.logoFileId && byId.get(String(company.logoFileId))
    return [String(company._id), file ? signedUrl(file, file.ownerId) : null]
  }))
}

function countBy(jobs, field) {
  return Object.fromEntries(ENUMS[field].map((value) => [value, jobs.filter((job) => job[field] === value).length]))
}

export async function landing(language) {
  const jobs = await Job.find(await visibleFilter(), 'title companyId employmentType workPreference experienceYears country location salary publishedAt').sort({ publishedAt: -1 })
  const latest = jobs.slice(0, LATEST_JOBS)
  const companies = await Company.find({ _id: { $in: latest.map((job) => job.companyId) } }, 'displayName logoFileId')
  const [logos, faqs] = await Promise.all([logoUrls(companies), listFaqs('candidate', language)])
  const companyById = new Map(companies.map((company) => [String(company._id), company]))

  return {
    total: jobs.length,
    counts: { workPreference: countBy(jobs, 'workPreference'), employmentType: countBy(jobs, 'employmentType') },
    jobs: latest.map((job) => {
      const company = companyById.get(String(job.companyId))
      return {
        id: String(job._id),
        title: job.title,
        company: { name: company?.displayName ?? '', logoUrl: logos.get(String(job.companyId)) ?? null },
        country: job.country,
        location: job.location ? { city: job.location.city, countryCode: job.location.countryCode } : null,
        employmentType: job.employmentType ?? null,
        workPreference: job.workPreference ?? null,
        experienceYears: job.experienceYears ?? null,
        salary: job.salary?.min != null || job.salary?.max != null ? job.salary.toObject() : null,
        publishedAt: job.publishedAt,
      }
    }),
    faqs,
  }
}
