import { config } from '../../config/env.js'
import { ENUMS, JOB_TYPES } from '../../config/enums.js'
import { signedUrl } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { matchesKeywords, searchText } from '../../lib/skills.js'
import { latestPosts } from '../blog/blog.service.js'
import { Company } from '../companies/companies.model.js'
import { publicCompanyDto } from '../companies/companies.service.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { agencyCard, agencyClients, haystack, isJobType, visibleFilter } from '../jobs/jobs.search.js'
import { jobFieldsDto } from '../jobs/jobs.service.js'
import { listFaqs } from '../meta/meta.service.js'
import { landingReviews } from '../reviews/reviews.service.js'
import { User } from '../users/users.model.js'

/*
 * The public landing page (no session): the newest visible jobs, live counts per work mode and employment type, the
 * candidate FAQs, the newest approved reviews and blog posts, and the footer's contact details (2026-11-13). Only what a job card already shows candidates is exposed. Logo links are signed for the logo's
 * owner, since there is no viewer; logo files are not access-logged (files.routes.js).
 */
const LATEST_JOBS = 6
const AGENCY_JOBS = 4

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
  const jobs = await Job.find(await visibleFilter(), 'title companyId employmentType workPreference experienceYears country location salary publishedAt visaSponsorship agency').sort({ publishedAt: -1 })
  const latest = jobs.slice(0, LATEST_JOBS)
  // Phase 7 (2026-11-23): the newest agency jobs for the landing's own section (hidden there when none).
  const agencyJobs = jobs.filter((job) => job.agency).slice(0, AGENCY_JOBS)
  const shown = [...latest, ...agencyJobs]
  const companies = await Company.find({ _id: { $in: shown.map((job) => job.companyId) } }, 'displayName logoFileId')
  const [logos, clients, faqs, reviews, posts] = await Promise.all([logoUrls(companies), agencyClients(shown), listFaqs('candidate', language), landingReviews(), latestPosts(language)])
  const companyById = new Map(companies.map((company) => [String(company._id), company]))
  const row = (job) => {
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
      visaSponsorship: Boolean(job.visaSponsorship),
      salary: job.salary?.min != null || job.salary?.max != null ? job.salary.toObject() : null,
      publishedAt: job.publishedAt,
      // The agency is the company; the client only where the agency shows it, as on /jobs.
      agency: agencyCard(job, clients),
    }
  }

  return {
    total: jobs.length,
    counts: { workPreference: countBy(jobs, 'workPreference'), employmentType: countBy(jobs, 'employmentType') },
    // 2026-11-20: the /agencies page's live figures (open agency jobs, approved agencies).
    agencies: { jobs: jobs.filter((job) => job.agency).length, accounts: await User.countDocuments({ role: 'agency', status: 'active' }) },
    jobs: latest.map(row),
    agencyJobs: agencyJobs.map(row),
    faqs,
    reviews,
    posts,
    contact: config.contact,
  }
}

/** The words a location search matches: the city, the country in this language, or "Remote". */
function placeText(job, language) {
  const region = new Intl.DisplayNames([language], { type: 'region' })
  const country = job.location?.countryCode
  return searchText([job.location?.city, country, country && region.of(country), job.country === 'REMOTE' && t(language, 'labels.workPreference.remote')].filter(Boolean).join(' '))
}

/**
 * GET /landing/jobs (owner 2026-11-16): the public job list behind the landing page's job links, so signed-out visitors
 * browse without signing in. Keywords and place narrow the list and its tab counts; one work mode or employment type
 * picks the tab. Every visible job is returned with the details a candidate reads (no saved, applied or match state).
 */
export async function publicJobs({ language, q, location, workPreference, employmentType, visa }) {
  const jobs = await Job.find(await visibleFilter()).sort({ publishedAt: -1 })
  const companies = await Company.find({ _id: { $in: [...new Set(jobs.map((job) => String(job.companyId)))] } })
  const companyById = new Map(companies.map((company) => [String(company._id), company]))
  const company = (job) => companyById.get(String(job.companyId))
  // Keywords, place and "sponsors a visa" narrow the list and its tab counts.
  const searched = jobs.filter(
    (job) => (!q || matchesKeywords(q, haystack(job, company(job), language))) && (!location || matchesKeywords(location, placeText(job, language))) && (!visa || job.visaSponsorship),
  )
  const items = searched.filter((job) => (!workPreference || job.workPreference === workPreference) && (!employmentType || isJobType(job, employmentType)))
  const [logos, clients] = await Promise.all([logoUrls(companies), agencyClients(items)])
  return {
    total: searched.length,
    // 2026-11-20: "agency" counts every agency job (the Agency tab).
    counts: { workPreference: countBy(searched, 'workPreference'), employmentType: Object.fromEntries(JOB_TYPES.map((type) => [type, searched.filter((job) => isJobType(job, type)).length])) },
    items: items.map((job) => ({
      ...jobFieldsDto(job),
      agency: agencyCard(job, clients),
      // The list only holds jobs of approved, active recruiters, so a verified company is one with a verification date.
      company: { ...publicCompanyDto(company(job), logos.get(String(job.companyId))), verified: Boolean(company(job).verifiedAt) },
    })),
  }
}
